"use client"

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react"
import { NearConnector } from "@hot-labs/near-connect"
import type { NearWalletBase, SignedMessage, SignAndSendTransactionParams } from "@hot-labs/near-connect"
import type { FinalExecutionOutcome } from "@near-js/types"
import { Buffer } from "buffer"
import { NEAR_CONFIG, CONSTANTS, getSigningRecipient } from "./config"
import type { NearSignatureData } from "./contracts/verification"

type SignAndSendTransactionsParams = {
  transactions: Array<SignAndSendTransactionParams & { signerId?: string }>
}

type NearWalletWithTransactions = NearWalletBase & {
  signAndSendTransactions?: (
    params: SignAndSendTransactionsParams,
  ) => Promise<FinalExecutionOutcome[] | FinalExecutionOutcome>
}

interface NearWalletContextType {
  accountId: string | null
  isConnected: boolean
  connect: () => Promise<void>
  disconnect: () => Promise<void>
  signMessage: (message: string) => Promise<NearSignatureData>
  signAndSendTransaction: (params: SignAndSendTransactionParams) => Promise<FinalExecutionOutcome>
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
        // Use the configured RPC URL for the current network
        const rpcUrl = NEAR_CONFIG.rpcUrl

        // Initialize WalletConnect SignClient if projectId is provided
        // This enables wallets that use WalletConnect protocol (e.g., MyNearWallet, Unity Wallet)
        const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID
        let walletConnectClient
        if (projectId) {
          // Dynamically import WalletConnect to avoid bundling if not used
          const SignClient = (await import("@walletconnect/sign-client")).default
          walletConnectClient = await SignClient.init({
            projectId,
            metadata: {
              name: "NEAR Citizens House",
              description: "NEAR governance and identity verification",
              url: typeof window !== "undefined" ? window.location.origin : "https://citizens.near.org",
              icons: [],
            },
          })
        }

        const connector = new NearConnector({
          network: NEAR_CONFIG.networkId as "testnet" | "mainnet",
          providers: {
            mainnet: NEAR_CONFIG.networkId === "mainnet" ? [rpcUrl] : ["https://rpc.mainnet.near.org"],
            testnet: NEAR_CONFIG.networkId === "testnet" ? [rpcUrl] : ["https://rpc.testnet.near.org"],
          },
          autoConnect: true,
          logger: process.env.NODE_ENV === "development" ? console : undefined,
          walletConnect: walletConnectClient,
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

  useEffect(() => {
    if (typeof window === "undefined") {
      return
    }

    let lastHiddenState: boolean | null = null
    const mediaQuery = window.matchMedia("(max-width: 640px)")

    const updateUserJotVisibility = () => {
      const isMobile = mediaQuery.matches
      const isWalletPopupOpen = isMobile && !!document.querySelector(".hot-connector-popup")

      if (lastHiddenState === isWalletPopupOpen) {
        return
      }

      lastHiddenState = isWalletPopupOpen
      document.body.classList.toggle("userjot-hidden-for-wallet-selector", isWalletPopupOpen)

      if (typeof window.uj?.setWidgetEnabled === "function") {
        window.uj?.setWidgetEnabled?.(!isWalletPopupOpen)
      }
    }

    updateUserJotVisibility()

    const observer = new MutationObserver(updateUserJotVisibility)
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "style"],
    })
    mediaQuery.addEventListener("change", updateUserJotVisibility)

    return () => {
      observer.disconnect()
      mediaQuery.removeEventListener("change", updateUserJotVisibility)
      document.body.classList.remove("userjot-hidden-for-wallet-selector")

      if (typeof window.uj?.setWidgetEnabled === "function") {
        window.uj?.setWidgetEnabled?.(true)
      }
    }
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
    async (message: string): Promise<NearSignatureData> => {
      if (!nearConnector || !accountId) {
        throw new Error("Wallet not connected")
      }

      const wallet = await nearConnector.wallet()

      if (!wallet || !("signMessage" in wallet)) {
        throw new Error(
          "This wallet does not support message signing. Please use Meteor Wallet or another compatible wallet.",
        )
      }

      const messageToSign = message || CONSTANTS.SIGNING_MESSAGE

      try {
        const recipient = getSigningRecipient()
        const nonce = Buffer.from(crypto.getRandomValues(new Uint8Array(32)))

        const signedMessage = (await (wallet as NearWalletBase).signMessage({
          message: messageToSign,
          recipient,
          nonce,
        })) as SignedMessage

        return {
          accountId,
          signature: signedMessage.signature,
          publicKey: signedMessage.publicKey,
          challenge: messageToSign, // Keep for interface compatibility
          timestamp: Date.now(), // Keep for interface compatibility
          nonce: Array.from(nonce), // Required for NEP-413 verification
          recipient, // Required for NEP-413 verification
        }
      } catch (error) {
        console.error("Failed to sign message:", error)
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred"
        throw new Error(`Failed to sign message: ${errorMessage}`)
      }
    },
    [nearConnector, accountId],
  )

  const signAndSendTransaction = useCallback(
    async (params: SignAndSendTransactionParams): Promise<FinalExecutionOutcome> => {
      if (!nearConnector || !accountId) {
        throw new Error("Wallet not connected")
      }

      const wallet = await nearConnector.wallet()

      if (!wallet) {
        throw new Error("Wallet not available")
      }

      try {
        const walletWithTransactions = wallet as NearWalletWithTransactions

        if (walletWithTransactions.signAndSendTransactions) {
          const result = await walletWithTransactions.signAndSendTransactions({
            transactions: [
              {
                signerId: accountId,
                ...params,
              },
            ],
          })

          return Array.isArray(result) ? result[0] : result
        }

        if (!("signAndSendTransaction" in wallet)) {
          throw new Error("Wallet does not support transaction signing")
        }

        const result = await (wallet as NearWalletBase).signAndSendTransaction({
          signerId: accountId,
          ...params,
        })

        return result
      } catch (error) {
        console.error("Failed to sign and send transaction:", error)
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred"
        throw new Error(`Transaction failed: ${errorMessage}`)
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
        signAndSendTransaction,
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
