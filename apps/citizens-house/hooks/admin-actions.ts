"use client"

import { useCallback, useState } from "react"
import { useNearWallet, NEAR_CONFIG, nearAccountIdSchema } from "@near-citizens/shared"
import { z } from "zod"

const yoctoNearSchema = z
  .string()
  .regex(/^\d+$/, "Must be a valid yoctoNEAR amount (digits only)")
  .min(1, "Amount required")

const addMemberInputSchema = z.object({
  accountId: nearAccountIdSchema,
  proposalBondYocto: yoctoNearSchema,
})

const createProposalInputSchema = z.object({
  description: z.string().min(1, "Description required").max(10000, "Description too long"),
  proposalBondYocto: yoctoNearSchema,
})

const updateBackendWalletInputSchema = z.object({
  newWallet: nearAccountIdSchema,
})

const updateCitizenRoleInputSchema = z.object({
  newRole: z.string().min(1, "Role name required").max(100, "Role name too long"),
})

// Gas constants (as strings for wallet compatibility)
// add_member creates 2 proposals (member + quorum update) with 7 cross-contract calls
const ADD_MEMBER_GAS = "300000000000000" // 300 TGas (max allowed, needed for full chain)
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
 * Uses browser-compatible base64 decoding (atob + TextDecoder)
 */
function extractReturnValue<T>(result: TransactionResult): T | null {
  if (result.status.SuccessValue) {
    try {
      // Browser-compatible base64 decode
      const binaryString = atob(result.status.SuccessValue)
      const bytes = new Uint8Array(binaryString.length)
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i)
      }
      const decoded = new TextDecoder().decode(bytes)
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
      // Validate inputs with safeParse
      const result = addMemberInputSchema.safeParse({ accountId, proposalBondYocto })
      if (!result.success) {
        const firstError = result.error.issues[0]
        throw new Error(`Invalid input: ${firstError?.path.join(".")} - ${firstError?.message}`)
      }

      if (!isConnected) {
        throw new Error("Wallet not connected")
      }

      if (!NEAR_CONFIG.bridgeContractId) {
        throw new Error("Bridge contract ID not configured")
      }

      setIsLoading(true)
      setError(null)

      try {
        const { accountId: validAccountId, proposalBondYocto: validBond } = result.data
        console.log(`[AdminActions] addMember deposit: ${validBond} yoctoNEAR`)

        const txResult = await signAndSendTransaction({
          receiverId: NEAR_CONFIG.bridgeContractId,
          actions: [
            {
              type: "FunctionCall",
              params: {
                methodName: "add_member",
                args: {
                  near_account_id: validAccountId,
                },
                gas: ADD_MEMBER_GAS,
                deposit: validBond,
              },
            },
          ],
        })

        // Return transaction hash
        const txHash = (txResult as { transaction: { hash: string } }).transaction?.hash
        if (!txHash) {
          console.warn("Transaction hash missing from result", txResult)
          throw new Error("Transaction completed but hash is missing")
        }
        return txHash
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
      // Validate inputs with safeParse
      const result = createProposalInputSchema.safeParse({ description, proposalBondYocto })
      if (!result.success) {
        const firstError = result.error.issues[0]
        throw new Error(`Invalid input: ${firstError?.path.join(".")} - ${firstError?.message}`)
      }

      if (!isConnected) {
        throw new Error("Wallet not connected")
      }

      if (!NEAR_CONFIG.bridgeContractId) {
        throw new Error("Bridge contract ID not configured")
      }

      setIsLoading(true)
      setError(null)

      try {
        const { description: validDesc, proposalBondYocto: validBond } = result.data
        console.log(`[AdminActions] createProposal deposit: ${validBond} yoctoNEAR`)

        const txResult = await signAndSendTransaction({
          receiverId: NEAR_CONFIG.bridgeContractId,
          actions: [
            {
              type: "FunctionCall",
              params: {
                methodName: "create_proposal",
                args: {
                  description: validDesc,
                },
                gas: CREATE_PROPOSAL_GAS,
                deposit: validBond,
              },
            },
          ],
        })

        // Parse proposal ID from return value
        const proposalId = extractReturnValue<number>(txResult as unknown as TransactionResult)
        if (proposalId === null) {
          const errorMsg = "Failed to extract proposal ID from contract response"
          console.warn(errorMsg, txResult)
          setError(errorMsg)
          throw new Error(errorMsg)
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
      // Validate inputs with safeParse
      const result = updateBackendWalletInputSchema.safeParse({ newWallet })
      if (!result.success) {
        const firstError = result.error.issues[0]
        throw new Error(`Invalid wallet address: ${firstError?.message}`)
      }

      if (!isConnected) {
        throw new Error("Wallet not connected")
      }

      if (!NEAR_CONFIG.bridgeContractId) {
        throw new Error("Bridge contract ID not configured")
      }

      setIsLoading(true)
      setError(null)

      try {
        const { newWallet: validWallet } = result.data
        await signAndSendTransaction({
          receiverId: NEAR_CONFIG.bridgeContractId,
          actions: [
            {
              type: "FunctionCall",
              params: {
                methodName: "update_backend_wallet",
                args: {
                  new_backend_wallet: validWallet,
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
      // Validate inputs with safeParse
      const result = updateCitizenRoleInputSchema.safeParse({ newRole })
      if (!result.success) {
        const firstError = result.error.issues[0]
        throw new Error(`Invalid role name: ${firstError?.message}`)
      }

      if (!isConnected) {
        throw new Error("Wallet not connected")
      }

      if (!NEAR_CONFIG.bridgeContractId) {
        throw new Error("Bridge contract ID not configured")
      }

      setIsLoading(true)
      setError(null)

      try {
        const { newRole: validRole } = result.data
        await signAndSendTransaction({
          receiverId: NEAR_CONFIG.bridgeContractId,
          actions: [
            {
              type: "FunctionCall",
              params: {
                methodName: "update_citizen_role",
                args: {
                  new_role: validRole,
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
