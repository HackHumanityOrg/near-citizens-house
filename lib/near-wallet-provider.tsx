"use client"

import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import { setupWalletSelector, type WalletSelector } from "@near-wallet-selector/core"
import { setupModal, type WalletSelectorModal } from "@near-wallet-selector/modal-ui"
import { setupMyNearWallet } from "@near-wallet-selector/my-near-wallet"
import { setupMeteorWallet } from "@near-wallet-selector/meteor-wallet"
import "@near-wallet-selector/modal-ui/styles.css"
import { Buffer } from "buffer"
import { NEAR_CONFIG, CONSTANTS, ERROR_MESSAGES } from "./config"
import type { NearSignatureData } from "./types"

interface NearWalletContextType {
  selector: WalletSelector | null
  modal: WalletSelectorModal | null
  accountId: string | null
  isConnected: boolean
  connect: () => Promise<void>
  disconnect: () => Promise<void>
  signMessage: (message: string) => Promise<NearSignatureData>
  isLoading: boolean
}

interface WalletWithSignMessage {
  signMessage(params: { message: string; recipient: string; nonce: Buffer }): Promise<{
    signature: string
    publicKey: string
    accountId: string
    state?: string
  }>
}

const NearWalletContext = createContext<NearWalletContextType | null>(null)

export function NearWalletProvider({ children }: { children: ReactNode }) {
  const [selector, setSelector] = useState<WalletSelector | null>(null)
  const [modal, setModal] = useState<WalletSelectorModal | null>(null)
  const [accountId, setAccountId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function initializeWalletSelector() {
      try {
        const _selector = await setupWalletSelector({
          network: NEAR_CONFIG.networkId as "testnet" | "mainnet",
          modules: [setupMyNearWallet(), setupMeteorWallet()],
        })

        const _modal = setupModal(_selector, {
          contractId: NEAR_CONFIG.contractName || "self-verification.testnet",
        })

        setSelector(_selector)
        setModal(_modal)

        const state = _selector.store.getState()
        if (state.accounts.length > 0) {
          setAccountId(state.accounts[0].accountId)
        }

        setIsLoading(false)
      } catch (error) {
        console.error("Failed to initialize NEAR wallet selector:", error)
        setIsLoading(false)
      }
    }

    initializeWalletSelector()
  }, [])

  useEffect(() => {
    if (!selector) return

    const subscription = selector.store.observable.subscribe((state) => {
      if (state.accounts.length > 0) {
        setAccountId(state.accounts[0].accountId)
      } else {
        setAccountId(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [selector])

  const connect = async () => {
    if (!modal) {
      console.error("Modal not initialized")
      return
    }
    modal.show()
  }

  const disconnect = async () => {
    if (!selector) return

    const wallet = await selector.wallet()
    await wallet.signOut()
    setAccountId(null)
  }

  const signMessage = async (_message: string): Promise<NearSignatureData> => {
    if (!selector || !accountId) {
      throw new Error(ERROR_MESSAGES.WALLET_NOT_CONNECTED)
    }

    const wallet = await selector.wallet()

    if (!("signMessage" in wallet)) {
      throw new Error(ERROR_MESSAGES.SIGNING_NOT_SUPPORTED)
    }

    const messageToSign = CONSTANTS.SIGNING_MESSAGE

    try {
      const nonce = Buffer.from(crypto.getRandomValues(new Uint8Array(32)))

      const signedMessage = await (wallet as unknown as WalletWithSignMessage).signMessage({
        message: messageToSign,
        recipient: accountId,
        nonce,
      })

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
  }

  return (
    <NearWalletContext.Provider
      value={{
        selector,
        modal,
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
