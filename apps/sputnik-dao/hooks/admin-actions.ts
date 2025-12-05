"use client"

import { useCallback, useState } from "react"
import { useNearWallet, NEAR_CONFIG } from "@near-citizens/shared"

// Gas constants (as strings for wallet compatibility)
const ADD_MEMBER_GAS = "200000000000000" // 200 TGas (cross-contract calls)
const CREATE_PROPOSAL_GAS = "100000000000000" // 100 TGas
const UPDATE_GAS = "30000000000000" // 30 TGas
const ONE_YOCTO = "1" // 1 yoctoNEAR

// Minimal type for transaction result
interface TransactionResult {
  status: {
    SuccessValue?: string
    Failure?: unknown
  }
}

/**
 * Parse contract errors to extract user-friendly messages
 */
function parseContractError(error: unknown): string {
  if (error instanceof Error) {
    if (error.message.includes("Smart contract panicked")) {
      const match = error.message.match(/Smart contract panicked: (.+)/)
      if (match) {
        return match[1]
      }
    }
    if (error.message.includes("Only backend wallet can call this function")) {
      return "Only the backend wallet can perform this action"
    }
    if (error.message.includes("Account is not verified")) {
      return "Account is not verified - cannot add to DAO"
    }
    return error.message
  }
  return "Transaction failed"
}

/**
 * Extract return value from transaction result
 */
function extractReturnValue<T>(result: TransactionResult): T | null {
  if (result.status.SuccessValue) {
    try {
      const decoded = Buffer.from(result.status.SuccessValue, "base64").toString()
      return JSON.parse(decoded) as T
    } catch {
      return null
    }
  }
  return null
}

export interface UseAdminActionsResult {
  /** Add a verified member to SputnikDAO via bridge */
  addMember: (accountId: string, proposalBondYocto: string) => Promise<string>
  /** Create a Vote proposal via bridge */
  createProposal: (description: string, proposalBondYocto: string) => Promise<number>
  /** Update the backend wallet address */
  updateBackendWallet: (newWallet: string) => Promise<void>
  /** Update the citizen role name */
  updateCitizenRole: (newRole: string) => Promise<void>
  /** Loading state for transaction operations */
  isLoading: boolean
  /** Error message from last operation */
  error: string | null
  /** Clear the current error */
  clearError: () => void
}

/**
 * React hook for admin actions that go through the bridge contract.
 * All operations require the backend wallet to be connected.
 *
 * Usage:
 * ```tsx
 * const { addMember, createProposal, isLoading, error } = useAdminActions()
 *
 * // Add a verified member (requires proposal bond in yoctoNEAR)
 * await addMember("alice.near", "100000000000000000000000") // 0.1 NEAR
 *
 * // Create a Vote proposal
 * const proposalId = await createProposal("Should we do X?", policy.proposalBond)
 * ```
 */
export function useAdminActions(): UseAdminActionsResult {
  const { signAndSendTransaction, isConnected } = useNearWallet()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const clearError = useCallback(() => setError(null), [])

  const addMember = useCallback(
    async (accountId: string, proposalBondYocto: string): Promise<string> => {
      if (!isConnected) {
        throw new Error("Wallet not connected")
      }

      if (!NEAR_CONFIG.bridgeContractId) {
        throw new Error("Bridge contract ID not configured")
      }

      setIsLoading(true)
      setError(null)

      try {
        // Use yoctoNEAR directly to avoid floating point precision issues
        console.log(`[AdminActions] addMember deposit: ${proposalBondYocto} yoctoNEAR`)

        const result = await signAndSendTransaction({
          receiverId: NEAR_CONFIG.bridgeContractId,
          actions: [
            {
              type: "FunctionCall",
              params: {
                methodName: "add_member",
                args: {
                  near_account_id: accountId,
                },
                gas: ADD_MEMBER_GAS,
                deposit: proposalBondYocto,
              },
            },
          ],
        })

        // Return transaction hash
        return (result as { transaction: { hash: string } }).transaction?.hash ?? ""
      } catch (err) {
        const errorMsg = parseContractError(err)
        setError(errorMsg)
        throw new Error(errorMsg)
      } finally {
        setIsLoading(false)
      }
    },
    [signAndSendTransaction, isConnected],
  )

  const createProposal = useCallback(
    async (description: string, proposalBondYocto: string): Promise<number> => {
      if (!isConnected) {
        throw new Error("Wallet not connected")
      }

      if (!NEAR_CONFIG.bridgeContractId) {
        throw new Error("Bridge contract ID not configured")
      }

      setIsLoading(true)
      setError(null)

      try {
        // Use yoctoNEAR directly to avoid floating point precision issues
        console.log(`[AdminActions] createProposal deposit: ${proposalBondYocto} yoctoNEAR`)

        const result = await signAndSendTransaction({
          receiverId: NEAR_CONFIG.bridgeContractId,
          actions: [
            {
              type: "FunctionCall",
              params: {
                methodName: "create_proposal",
                args: {
                  description,
                },
                gas: CREATE_PROPOSAL_GAS,
                deposit: proposalBondYocto,
              },
            },
          ],
        })

        // Parse proposal ID from return value
        const proposalId = extractReturnValue<number>(result as unknown as TransactionResult)
        if (proposalId === null) {
          console.warn("Failed to get proposal ID from contract response")
          return -1
        }

        return proposalId
      } catch (err) {
        const errorMsg = parseContractError(err)
        setError(errorMsg)
        throw new Error(errorMsg)
      } finally {
        setIsLoading(false)
      }
    },
    [signAndSendTransaction, isConnected],
  )

  const updateBackendWallet = useCallback(
    async (newWallet: string): Promise<void> => {
      if (!isConnected) {
        throw new Error("Wallet not connected")
      }

      if (!NEAR_CONFIG.bridgeContractId) {
        throw new Error("Bridge contract ID not configured")
      }

      setIsLoading(true)
      setError(null)

      try {
        await signAndSendTransaction({
          receiverId: NEAR_CONFIG.bridgeContractId,
          actions: [
            {
              type: "FunctionCall",
              params: {
                methodName: "update_backend_wallet",
                args: {
                  new_backend_wallet: newWallet,
                },
                gas: UPDATE_GAS,
                deposit: ONE_YOCTO,
              },
            },
          ],
        })
      } catch (err) {
        const errorMsg = parseContractError(err)
        setError(errorMsg)
        throw new Error(errorMsg)
      } finally {
        setIsLoading(false)
      }
    },
    [signAndSendTransaction, isConnected],
  )

  const updateCitizenRole = useCallback(
    async (newRole: string): Promise<void> => {
      if (!isConnected) {
        throw new Error("Wallet not connected")
      }

      if (!NEAR_CONFIG.bridgeContractId) {
        throw new Error("Bridge contract ID not configured")
      }

      setIsLoading(true)
      setError(null)

      try {
        await signAndSendTransaction({
          receiverId: NEAR_CONFIG.bridgeContractId,
          actions: [
            {
              type: "FunctionCall",
              params: {
                methodName: "update_citizen_role",
                args: {
                  new_role: newRole,
                },
                gas: UPDATE_GAS,
                deposit: ONE_YOCTO,
              },
            },
          ],
        })
      } catch (err) {
        const errorMsg = parseContractError(err)
        setError(errorMsg)
        throw new Error(errorMsg)
      } finally {
        setIsLoading(false)
      }
    },
    [signAndSendTransaction, isConnected],
  )

  return {
    addMember,
    createProposal,
    updateBackendWallet,
    updateCitizenRole,
    isLoading,
    error,
    clearError,
  }
}
