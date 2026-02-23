"use client"

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react"
import { NearConnector } from "@hot-labs/near-connect"
import posthog from "posthog-js"
import type {
  NearWalletBase,
  SignedMessage,
  SignAndSendTransactionParams,
  SignDelegateActionParams,
  SignDelegateActionResult,
} from "@hot-labs/near-connect"
import type { FinalExecutionOutcome } from "@near-js/types"
import { Buffer } from "buffer"
import { NEAR_CONFIG, CONSTANTS, getSigningRecipient } from "../config"
import { env } from "../schemas/env"
import { nearAccountIdSchema, type NearAccountId, type NearSignatureData } from "../schemas/near"

/**
 * Validate and convert an account ID string from external SDK to NearAccountId.
 * Returns null if the account ID is invalid.
 */
function validateAccountId(accountId: string | undefined | null): NearAccountId | null {
  if (!accountId) return null
  const result = nearAccountIdSchema.safeParse(accountId)
  return result.success ? result.data : null
}

/**
 * Check if a wallet supports NEP-366 delegate actions (meta-transactions).
 *
 * The manifest feature is named "signDelegateActions" (plural) in the actual JSON,
 * despite the TypeScript WalletFeatures interface using "signDelegateAction" (singular).
 * We check the runtime value directly to handle this naming inconsistency.
 */
function walletSupportsMetaTransactions(wallet: NearWalletBase | null | undefined): boolean {
  if (!wallet?.manifest?.features) return false
  const features = wallet.manifest.features as unknown as Record<string, boolean>
  return features.signDelegateActions === true || features.signDelegateAction === true
}

type SignAndSendTransactionsParams = {
  transactions: Array<SignAndSendTransactionParams & { signerId?: string }>
}

type NearWalletWithTransactions = NearWalletBase & {
  signAndSendTransactions?: (
    params: SignAndSendTransactionsParams,
  ) => Promise<FinalExecutionOutcome[] | FinalExecutionOutcome>
}

interface NearWalletContextType {
  accountId: NearAccountId | null
  walletName: string | null
  isConnected: boolean
  connect: () => Promise<void>
  disconnect: () => Promise<void>
  signMessage: (message: string) => Promise<NearSignatureData>
  signAndSendTransaction: (params: SignAndSendTransactionParams) => Promise<FinalExecutionOutcome>
  signDelegateActions: ((params: SignDelegateActionParams) => Promise<SignDelegateActionResult[]>) | null
  supportsMetaTransactions: boolean
  isLoading: boolean
}

const NearWalletContext = createContext<NearWalletContextType | null>(null)

// Module-level singleton to avoid re-initializing WalletConnect on every connect() call
let wcClient: Awaited<ReturnType<(typeof import("@walletconnect/sign-client"))["default"]["init"]>> | undefined
let wcInitPromise: Promise<typeof wcClient> | undefined

async function getOrInitWalletConnect(projectId: string, origin: string): Promise<typeof wcClient> {
  if (wcClient) return wcClient
  if (!wcInitPromise) {
    wcInitPromise = (async () => {
      const SignClient = (await import("@walletconnect/sign-client")).default
      wcClient = await SignClient.init({
        projectId,
        metadata: {
          name: "NEAR Citizens House",
          description: "NEAR governance and identity verification",
          url: origin,
          icons: [],
        },
      })
      return wcClient
    })()
  }
  return wcInitPromise
}

export function NearWalletProvider({ children }: { children: ReactNode }) {
  const [nearConnector, setNearConnector] = useState<NearConnector | null>(null)
  const [accountId, setAccountId] = useState<NearAccountId | null>(null)
  const [walletName, setWalletName] = useState<string | null>(null)
  const [supportsMetaTransactions, setSupportsMetaTransactions] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  const handleSignIn = useCallback(
    (payload: {
      wallet: NearWalletBase
      accounts: Array<{ accountId: string; publicKey?: string }>
      success: boolean
    }) => {
      const rawAccountId = payload?.accounts?.[0]?.accountId
      const validatedAccountId = validateAccountId(rawAccountId)
      setAccountId(validatedAccountId)
      setWalletName(payload?.wallet?.manifest?.name ?? null)
      setSupportsMetaTransactions(walletSupportsMetaTransactions(payload?.wallet))
      if (validatedAccountId) posthog.identify(validatedAccountId)
    },
    [],
  )

  const handleSignOut = useCallback(() => {
    setAccountId(null)
    setWalletName(null)
    setSupportsMetaTransactions(false)
    posthog.reset()
  }, [])

  useEffect(() => {
    async function initializeWalletConnector() {
      try {
        // Fast init: no WalletConnect download — WC wallets are filtered out until connect()
        const connector = new NearConnector({
          network: NEAR_CONFIG.networkId as "testnet" | "mainnet",
          autoConnect: true,
          // walletConnect intentionally omitted — deferred to connect() to avoid 3-5 MB download on every page load
        })

        connector.on("wallet:signIn", handleSignIn)
        connector.on("wallet:signOut", handleSignOut)

        // Restore session for extension wallets (localStorage read, no network)
        try {
          const connected = await connector.getConnectedWallet()
          const rawAccountId = connected?.accounts?.[0]?.accountId
          const validatedAccountId = validateAccountId(rawAccountId)
          setAccountId(validatedAccountId)
          setWalletName(connected?.wallet?.manifest?.name ?? null)
          setSupportsMetaTransactions(walletSupportsMetaTransactions(connected?.wallet))
          if (validatedAccountId) posthog.identify(validatedAccountId)
        } catch {
          // No previous session or WalletConnect session (user will need to reconnect once)
        }

        setNearConnector(connector)
      } finally {
        setIsLoading(false)
      }
    }

    initializeWalletConnector()
  }, [handleSignIn, handleSignOut])

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
      // attributes omitted — only need to detect popup presence/absence in the DOM tree
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
    // Lazy-init WalletConnect — downloads the 3-5 MB bundle only on first "Connect Wallet" click
    let wc: typeof wcClient = undefined
    if (env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID) {
      wc = await getOrInitWalletConnect(
        env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID,
        typeof window !== "undefined" ? window.location.origin : "https://citizens.near.org",
      )
    }

    // Create a new connector with WalletConnect enabled for the selection popup
    const connector = new NearConnector({
      network: NEAR_CONFIG.networkId as "testnet" | "mainnet",
      autoConnect: false,
      walletConnect: wc,
    })
    connector.on("wallet:signIn", handleSignIn)
    connector.on("wallet:signOut", handleSignOut)

    const id = await connector.selectWallet()
    if (id) {
      await connector.connect(id)
    }

    // Replace the active connector so disconnect/signMessage/etc. use the new one
    setNearConnector(connector)
  }, [handleSignIn, handleSignOut])

  const disconnect = useCallback(async () => {
    if (!nearConnector) return
    await nearConnector.disconnect()
    setAccountId(null)
    posthog.reset()
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
          nonce: nonce.toString("base64"), // base64 encoded for consistent handling
          recipient, // Required for NEP-413 verification
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred"
        throw new Error(`Failed to sign message: ${errorMessage}`, { cause: error })
      }
    },
    [nearConnector, accountId],
  )

  const signDelegateActions = useCallback(
    async (params: SignDelegateActionParams): Promise<SignDelegateActionResult[]> => {
      if (!nearConnector || !accountId) {
        throw new Error("Wallet not connected")
      }

      const wallet = await nearConnector.wallet()

      if (!wallet || !walletSupportsMetaTransactions(wallet)) {
        throw new Error("Wallet does not support delegate actions")
      }

      try {
        const result = await wallet.signDelegateActions(params)
        return result.signedDelegateActions
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred"
        throw new Error(`Failed to sign delegate actions: ${errorMessage}`, { cause: error })
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
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred"
        throw new Error(`Transaction failed: ${errorMessage}`, { cause: error })
      }
    },
    [nearConnector, accountId],
  )

  return (
    <NearWalletContext.Provider
      value={{
        accountId,
        walletName,
        isConnected: !!accountId,
        connect,
        disconnect,
        signMessage,
        signAndSendTransaction,
        signDelegateActions: supportsMetaTransactions ? signDelegateActions : null,
        supportsMetaTransactions,
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
