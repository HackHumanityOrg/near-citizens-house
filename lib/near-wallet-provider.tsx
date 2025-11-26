"use client"

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react"
import { NearConnector } from "@hot-labs/near-connect"
import type { NearWalletBase, SignedMessage } from "@hot-labs/near-connect"
import { Buffer } from "buffer"
import { NEAR_CONFIG, CONSTANTS, ERROR_MESSAGES } from "./config"
import type { NearSignatureData } from "./types"

interface NearWalletContextType {
  accountId: string | null
  isConnected: boolean
  connect: () => Promise<void>
  disconnect: () => Promise<void>
  signMessage: (message: string) => Promise<NearSignatureData>
  isLoading: boolean
}

const NearWalletContext = createContext<NearWalletContextType | null>(null)

export function NearWalletProvider({ children }: { children: ReactNode }) {
  const [nearConnector, setNearConnector] = useState<NearConnector | null>(null)
  const [accountId, setAccountId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function initializeWalletConnector() {
      try {
        const connector = new NearConnector({
          network: NEAR_CONFIG.networkId as "testnet" | "mainnet",
          autoConnect: true,
          logger: process.env.NODE_ENV === "development" ? console : undefined,
        })

        // Connection/disconnection events
        connector.on("wallet:signIn", (payload) => {
          const nextAccountId = payload?.accounts?.[0]?.accountId
          setAccountId(nextAccountId || null)
        })
        connector.on("wallet:signOut", () => {
          setAccountId(null)
        })

        // Try existing session
        try {
          const connected = await connector.getConnectedWallet()
          const nextAccountId = connected?.accounts?.[0]?.accountId
          setAccountId(nextAccountId || null)
        } catch {
          // No previous session
        }

        setNearConnector(connector)
        setIsLoading(false)
      } catch (error) {
        console.error("Failed to initialize NEAR wallet connector:", error)
        setIsLoading(false)
      }
    }

    initializeWalletConnector()
  }, [])

  const connect = useCallback(async () => {
    if (!nearConnector) {
      console.error("Connector not initialized")
      return
    }
    // Show wallet selector and connect with the chosen one
    const id = await nearConnector.selectWallet()
    if (id) {
      await nearConnector.connect(id)
    }
  }, [nearConnector])

  const disconnect = useCallback(async () => {
    if (!nearConnector) return
    await nearConnector.disconnect()
    setAccountId(null)
  }, [nearConnector])

  const signMessage = useCallback(
    async (_message: string): Promise<NearSignatureData> => {
      if (!nearConnector || !accountId) {
        throw new Error(ERROR_MESSAGES.WALLET_NOT_CONNECTED)
      }

      const wallet = await nearConnector.wallet()

      if (!wallet || !("signMessage" in wallet)) {
        throw new Error(ERROR_MESSAGES.SIGNING_NOT_SUPPORTED)
      }

      const messageToSign = CONSTANTS.SIGNING_MESSAGE

      try {
        const nonce = Buffer.from(crypto.getRandomValues(new Uint8Array(32)))

        const signedMessage = (await (wallet as NearWalletBase).signMessage({
          message: messageToSign,
          recipient: accountId,
          nonce,
        })) as SignedMessage

        return {
          accountId,
          signature: signedMessage.signature,
          publicKey: signedMessage.publicKey,
          challenge: messageToSign, // Keep for interface compatibility
          timestamp: Date.now(), // Keep for interface compatibility
          nonce: Array.from(nonce), // Required for NEP-413 verification
          recipient: accountId, // Required for NEP-413 verification
        }
      } catch (error) {
        console.error("Failed to sign message:", error)
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred"
        throw new Error(`Failed to sign message: ${errorMessage}`)
      }
    },
    [nearConnector, accountId],
  )

  return (
    <NearWalletContext.Provider
      value={{
        accountId,
        isConnected: !!accountId,
        connect,
        disconnect,
        signMessage,
        isLoading,
      }}
    >
      {children}
    </NearWalletContext.Provider>
  )
}

export function useNearWallet() {
  const context = useContext(NearWalletContext)
  if (!context) {
    throw new Error("useNearWallet must be used within NearWalletProvider")
  }
  return context
}
