"use client"

import { useCallback, useState } from "react"
import { useNearWallet, NEAR_CONFIG, type Vote } from "@near-citizens/shared"

// Minimal type for transaction result (from @near-js/types)
interface TransactionResult {
  status: {
    SuccessValue?: string
    Failure?: unknown
  }
}

// Gas and deposit constants
const DEFAULT_GAS = "30000000000000" // 30 TGas
const CANCEL_GAS = "10000000000000" // 10 TGas
const ONE_YOCTO = "1" // 1 yoctoNEAR for cross-contract calls
const ZERO_DEPOSIT = "0"

/**
 * Parse contract errors to extract user-friendly messages
 */
function parseContractError(error: unknown): string {
  if (error instanceof Error) {
    // Extract panic message from NEAR contract errors
    if (error.message.includes("Smart contract panicked")) {
      const match = error.message.match(/Smart contract panicked: (.+)/)
      if (match) {
        return match[1]
      }
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

export interface UseGovernanceResult {
  /** Create a new governance proposal */
  createProposal: (
    title: string,
    description: string,
    quorumPercentage: number,
    discourseUrl?: string,
  ) => Promise<number>
  /** Cast a vote on a proposal */
  vote: (proposalId: number, vote: Vote) => Promise<void>
  /** Finalize a proposal after voting ends */
  finalizeProposal: (proposalId: number) => Promise<void>
  /** Cancel an active proposal (only by proposer) */
  cancelProposal: (proposalId: number) => Promise<void>
  /** Loading state for transaction operations */
  isLoading: boolean
  /** Error message from last operation */
  error: string | null
  /** Clear the current error */
  clearError: () => void
}

/**
 * React hook for governance actions that require wallet signing.
 * All operations are signed by the connected user's wallet.
 */
export function useGovernance(): UseGovernanceResult {
  const { signAndSendTransaction, isConnected } = useNearWallet()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const clearError = useCallback(() => setError(null), [])

  const createProposal = useCallback(
    async (title: string, description: string, quorumPercentage: number, discourseUrl?: string): Promise<number> => {
      if (!isConnected) {
        throw new Error("Wallet not connected")
      }

      if (!NEAR_CONFIG.governanceContractId) {
        throw new Error("Governance contract ID not configured")
      }

      setIsLoading(true)
      setError(null)

      try {
        const result = await signAndSendTransaction({
          receiverId: NEAR_CONFIG.governanceContractId,
          actions: [
            {
              type: "FunctionCall",
              params: {
                methodName: "create_proposal",
                args: {
                  title,
                  description,
                  discourse_url: discourseUrl || null,
                  quorum_percentage: quorumPercentage,
                },
                gas: DEFAULT_GAS,
                deposit: ONE_YOCTO, // Required for cross-contract call
              },
            },
          ],
        })

        const proposalId = extractReturnValue<number>(result as unknown as TransactionResult)
        if (proposalId === null) {
          throw new Error("Failed to get proposal ID from contract response")
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

  const vote = useCallback(
    async (proposalId: number, voteChoice: Vote): Promise<void> => {
      if (!isConnected) {
        throw new Error("Wallet not connected")
      }

      if (!NEAR_CONFIG.governanceContractId) {
        throw new Error("Governance contract ID not configured")
      }

      setIsLoading(true)
      setError(null)

      try {
        await signAndSendTransaction({
          receiverId: NEAR_CONFIG.governanceContractId,
          actions: [
            {
              type: "FunctionCall",
              params: {
                methodName: "vote",
                args: {
                  proposal_id: proposalId,
                  vote: voteChoice,
                },
                gas: DEFAULT_GAS,
                deposit: ONE_YOCTO, // Required for cross-contract call
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

  const finalizeProposal = useCallback(
    async (proposalId: number): Promise<void> => {
      if (!isConnected) {
        throw new Error("Wallet not connected")
      }

      if (!NEAR_CONFIG.governanceContractId) {
        throw new Error("Governance contract ID not configured")
      }

      setIsLoading(true)
      setError(null)

      try {
        await signAndSendTransaction({
          receiverId: NEAR_CONFIG.governanceContractId,
          actions: [
            {
              type: "FunctionCall",
              params: {
                methodName: "finalize_proposal",
                args: { proposal_id: proposalId },
                gas: DEFAULT_GAS,
                deposit: ZERO_DEPOSIT,
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

  const cancelProposal = useCallback(
    async (proposalId: number): Promise<void> => {
      if (!isConnected) {
        throw new Error("Wallet not connected")
      }

      if (!NEAR_CONFIG.governanceContractId) {
        throw new Error("Governance contract ID not configured")
      }

      setIsLoading(true)
      setError(null)

      try {
        await signAndSendTransaction({
          receiverId: NEAR_CONFIG.governanceContractId,
          actions: [
            {
              type: "FunctionCall",
              params: {
                methodName: "cancel_proposal",
                args: { proposal_id: proposalId },
                gas: CANCEL_GAS,
                deposit: ZERO_DEPOSIT,
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
    createProposal,
    vote,
    finalizeProposal,
    cancelProposal,
    isLoading,
    error,
    clearError,
  }
}
