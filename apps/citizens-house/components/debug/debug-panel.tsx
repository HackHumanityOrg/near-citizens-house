"use client"

import { useState, useEffect, useRef } from "react"
import { Bug, X, Loader2, Check } from "lucide-react"
import { useDebugContext } from "@/lib/providers/debug-provider"
import { NEAR_CONFIG, useNearWallet } from "@/lib"
import { MiddleTruncate } from "@/components/ui/middle-truncate"
import { checkIsVerified } from "@/app/citizens/actions"

type Status = "idle" | "signing" | "submitting" | "success" | "error"

export function DebugPanel() {
  if (process.env.NODE_ENV === "production") return null
  return <DebugPanelInner />
}

function DebugPanelInner() {
  const { isDebugEnabled, isDebugPanelOpen, setDebugPanelOpen } = useDebugContext()
  const { accountId, isConnected, connect, signMessage } = useNearWallet()
  const [status, setStatus] = useState<Status>("idle")
  const [error, setError] = useState<string | null>(null)
  const [verifiedCheck, setVerifiedCheck] = useState<{ accountId: string; verified: boolean } | null>(null)

  useEffect(() => {
    if (!isConnected || !accountId) return
    checkIsVerified(accountId).then((verified) => {
      setVerifiedCheck({ accountId, verified })
    })
  }, [isConnected, accountId])

  // Drag state
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null)
  const dragRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null)

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const drag = dragRef.current
      if (!drag) return
      setPosition({
        x: drag.originX + (e.clientX - drag.startX),
        y: drag.originY + (e.clientY - drag.startY),
      })
    }
    const handleMouseUp = () => {
      dragRef.current = null
    }
    window.addEventListener("mousemove", handleMouseMove)
    window.addEventListener("mouseup", handleMouseUp)
    return () => {
      window.removeEventListener("mousemove", handleMouseMove)
      window.removeEventListener("mouseup", handleMouseUp)
    }
  }, [])

  const handleDragStart = (e: React.MouseEvent) => {
    // Don't start drag if clicking the close button
    if ((e.target as HTMLElement).closest("button")) return
    const el = (e.target as HTMLElement).closest("[data-debug-panel]") as HTMLElement | null
    if (!el) return
    const rect = el.getBoundingClientRect()
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      originX: position?.x ?? rect.left,
      originY: position?.y ?? rect.top,
    }
    e.preventDefault()
  }

  const isVerified = verifiedCheck?.accountId === accountId ? verifiedCheck.verified : null

  const handleForceVerify = async () => {
    if (!signMessage) return

    setStatus("signing")
    setError(null)

    try {
      const signatureData = await signMessage("")
      setStatus("submitting")

      const res = await fetch("/api/debug/force-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nearSignature: {
            accountId: signatureData.accountId,
            signature: signatureData.signature,
            publicKey: signatureData.publicKey,
            nonce: signatureData.nonce,
            timestamp: signatureData.timestamp,
          },
        }),
      })

      const data = await res.json()

      if (data.success) {
        setStatus("success")
        if (accountId) setVerifiedCheck({ accountId, verified: true })
      } else {
        setStatus("error")
        setError(data.error ?? "Unknown error")
      }
    } catch (err) {
      setStatus("error")
      setError(err instanceof Error ? err.message : "Failed to verify")
    }
  }

  if (!isDebugEnabled) return null

  if (!isDebugPanelOpen) {
    return (
      <button
        onClick={() => setDebugPanelOpen(true)}
        className="fixed bottom-4 right-4 z-[9999] bg-[#1a1a1a] border border-[#333] rounded-full p-3 shadow-lg hover:bg-[#2a2a2a] transition-colors"
        title="Open Debug Panel"
      >
        <Bug className="w-5 h-5 text-[#ffda1e]" />
      </button>
    )
  }

  const panelStyle: React.CSSProperties = position
    ? { position: "fixed", left: position.x, top: position.y, bottom: "auto", right: "auto" }
    : {}

  return (
    <div
      data-debug-panel
      className="fixed bottom-4 right-4 z-[9999] bg-[#1a1a1a] border border-[#333] rounded-lg shadow-2xl w-[360px] font-mono text-sm"
      style={panelStyle}
    >
      {/* Header — drag handle */}
      <div
        onMouseDown={handleDragStart}
        className="flex items-center justify-between px-3 py-2 bg-[#222] border-b border-[#333] rounded-t-lg cursor-grab active:cursor-grabbing select-none"
      >
        <div className="flex items-center gap-2">
          <Bug className="w-4 h-4 text-[#ffda1e]" />
          <span className="text-xs font-bold text-[#ffda1e] uppercase tracking-wider">Debug</span>
        </div>
        <button onClick={() => setDebugPanelOpen(false)} className="p-1 hover:bg-[#333] rounded transition-colors">
          <X className="w-4 h-4 text-[#888]" />
        </button>
      </div>

      {/* Force Verify Section */}
      <div className="p-3 space-y-3">
        <span className="text-xs font-semibold text-[#aaa] uppercase tracking-wider">Force Verify</span>

        {!isConnected ? (
          <button
            onClick={connect}
            className="w-full px-3 py-2 text-xs rounded bg-[#333] text-[#ccc] hover:bg-[#444] transition-colors"
          >
            Connect Wallet
          </button>
        ) : (
          <div className="space-y-2">
            {/* Account display */}
            <div className="flex items-center justify-between">
              <span className="text-xs text-[#888]">Account:</span>
              <span className="text-xs text-[#ccc]">
                <MiddleTruncate text={accountId ?? ""} className="max-w-[180px]" />
              </span>
            </div>

            {/* Verification status */}
            {isVerified === true && (
              <div className="flex items-center gap-1.5 px-2 py-1.5 rounded bg-[#1a3a1a] border border-[#2a5a2a]">
                <Check className="w-3.5 h-3.5 text-[#4ade80]" />
                <span className="text-xs text-[#4ade80]">Already verified</span>
              </div>
            )}

            {/* Force Verify button */}
            {isVerified !== true && (
              <button
                onClick={handleForceVerify}
                disabled={status === "signing" || status === "submitting"}
                className="w-full px-3 py-2 text-xs rounded bg-[#ffda1e] text-black font-semibold hover:bg-[#e6c41b] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {status === "signing" && (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Signing...
                  </>
                )}
                {status === "submitting" && (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Submitting...
                  </>
                )}
                {(status === "idle" || status === "error") && "Force Verify"}
                {status === "success" && (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    Verified
                  </>
                )}
              </button>
            )}

            {/* Error display */}
            {status === "error" && error && (
              <div className="px-2 py-1.5 rounded bg-[#3a1a1a] border border-[#5a2a2a]">
                <span className="text-xs text-[#f87171] break-all">{error}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-3 py-2 bg-[#222] border-t border-[#333] rounded-b-lg text-xs text-[#666]">
        {NEAR_CONFIG.networkId}
      </div>
    </div>
  )
}
