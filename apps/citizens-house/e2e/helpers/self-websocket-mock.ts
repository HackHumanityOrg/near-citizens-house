/**
 * Self.xyz WebSocket Mock for E2E Testing
 *
 * The Self SDK's SelfQRcode component uses Socket.IO WebSocket to detect
 * verification success. This mock intercepts the WebSocket connection
 * and simulates the verification flow.
 *
 * Socket.IO Protocol (from @selfxyz/qrcode source):
 * - Uses socket.io-client with transports: ["websocket"]
 * - Connects to ${websocketUrl}/websocket with query: { sessionId, clientType: "web" }
 * - Listens for "mobile_status" events with { status: string } data
 * - status values: mobile_connected, proof_generation_started, proof_generated, proof_verified
 *
 * Engine.IO + Socket.IO Handshake:
 * 1. Server sends Engine.IO OPEN: 0{...json...}
 * 2. Client sends Socket.IO CONNECT: 40
 * 3. Server sends Socket.IO CONNECT: 40 (confirmation)
 * 4. Events can now be exchanged: 42["event_name",{data}]
 */

import type { Page, WebSocketRoute } from "@playwright/test"

interface WebSocketMockOptions {
  /** Delay before sending proof_verified after triggerSuccess is called (ms) */
  successDelay?: number
}

interface WebSocketMockResult {
  /** Call this to trigger the verification success sequence */
  triggerSuccess: () => void
}

/**
 * Sets up a mock for Self.xyz WebSocket that simulates successful verification.
 * Call this BEFORE navigating to the page that renders the QR code.
 *
 * @param page - Playwright page
 * @param options - Configuration options
 * @returns Object with triggerSuccess function
 */
export async function setupSelfWebSocketMock(
  page: Page,
  options: WebSocketMockOptions = {},
): Promise<WebSocketMockResult> {
  const { successDelay = 500 } = options

  let wsRoute: WebSocketRoute | null = null
  let successTriggered = false
  let connectionReady = false
  let connectedNamespace = "/" // Track which namespace the client connected to

  // Intercept Self.xyz WebSocket connections
  await page.routeWebSocket(/websocket\.self\.xyz/, async (ws) => {
    wsRoute = ws
    connectionReady = false
    connectedNamespace = "/"
    console.log("[Mock WebSocket] Self.xyz WebSocket intercepted")

    // Step 1: Send Engine.IO OPEN packet
    const sessionId = `mock-sid-${Date.now()}`
    ws.send(`0{"sid":"${sessionId}","pingInterval":25000,"pingTimeout":20000,"upgrades":[]}`)
    console.log("[Mock WebSocket] Sent: Engine.IO OPEN")

    // Handle incoming messages
    ws.onMessage((message) => {
      const msgStr = typeof message === "string" ? message : message.toString()
      console.log("[Mock WebSocket] Received:", msgStr)

      // Socket.IO CONNECT handling
      // Default namespace: "40" or "40{...}"
      // Named namespace: "40/namespace," or "40/namespace,{...}"
      if (msgStr === "40" || msgStr.startsWith("40{")) {
        // Default namespace
        ws.send("40")
        connectionReady = true
        connectedNamespace = "/"
        console.log("[Mock WebSocket] Sent: Socket.IO CONNECT confirmation (default namespace)")
      } else if (msgStr.startsWith("40/")) {
        // Named namespace - extract namespace and respond with sid
        // Server must respond with: 40/namespace,{"sid":"..."}
        const namespaceMatch = msgStr.match(/^40(\/[^,]+),/)
        if (namespaceMatch) {
          const namespace = namespaceMatch[1] // e.g., "/websocket"
          const socketSid = `mock-socket-${Date.now()}`
          ws.send(`40${namespace},{"sid":"${socketSid}"}`)
          connectionReady = true
          connectedNamespace = namespace
          console.log(
            `[Mock WebSocket] Sent: Socket.IO CONNECT confirmation for namespace ${namespace} (sid: ${socketSid})`,
          )
        }
      }

      // Respond to Engine.IO ping (2) with pong (3)
      if (msgStr === "2") {
        ws.send("3")
        console.log("[Mock WebSocket] Sent: pong")
      }

      // Handle self_app event (SDK sends this after mobile_connected)
      if (msgStr.includes('"self_app"')) {
        console.log("[Mock WebSocket] Received: self_app event")
      }
    })
  })

  // Helper to format Socket.IO events with the correct namespace
  const formatEvent = (eventName: string, data: object): string => {
    // If connected to a named namespace, include it in the event
    // Format: 42/namespace,["event",data] for named namespace
    // Format: 42["event",data] for default namespace
    if (connectedNamespace && connectedNamespace !== "/") {
      return `42${connectedNamespace},["${eventName}",${JSON.stringify(data)}]`
    }
    return `42["${eventName}",${JSON.stringify(data)}]`
  }

  const triggerSuccess = () => {
    if (successTriggered) {
      console.log("[Mock WebSocket] Success already triggered, ignoring")
      return
    }
    if (!wsRoute) {
      console.error("[Mock WebSocket] No WebSocket route available - was the QR code rendered?")
      return
    }
    if (!connectionReady) {
      console.warn("[Mock WebSocket] Connection not ready yet, triggering anyway...")
    }

    successTriggered = true
    console.log(`[Mock WebSocket] Triggering verification success sequence (namespace: ${connectedNamespace})...`)

    // Simulate the verification flow with delays
    // Socket.IO EVENT format depends on namespace
    setTimeout(() => {
      if (!wsRoute) return
      const msg = formatEvent("mobile_status", { status: "mobile_connected" })
      wsRoute.send(msg)
      console.log("[Mock WebSocket] Sent: mobile_connected")
    }, 100)

    setTimeout(() => {
      if (!wsRoute) return
      const msg = formatEvent("mobile_status", { status: "proof_generation_started" })
      wsRoute.send(msg)
      console.log("[Mock WebSocket] Sent: proof_generation_started")
    }, 200)

    setTimeout(() => {
      if (!wsRoute) return
      const msg = formatEvent("mobile_status", { status: "proof_generated" })
      wsRoute.send(msg)
      console.log("[Mock WebSocket] Sent: proof_generated")
    }, 300)

    setTimeout(() => {
      if (!wsRoute) return
      // This triggers onSuccess in the SelfQRcode component!
      const msg = formatEvent("mobile_status", { status: "proof_verified" })
      wsRoute.send(msg)
      console.log("[Mock WebSocket] Sent: proof_verified (triggers onSuccess)")
    }, successDelay)
  }

  return { triggerSuccess }
}
