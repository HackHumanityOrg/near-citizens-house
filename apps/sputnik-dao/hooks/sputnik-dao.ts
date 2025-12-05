"use client"

import { useCallback, useState } from "react"
import { useNearWallet, NEAR_CONFIG, type SputnikAction, type SputnikProposalKind } from "@near-citizens/shared"

// Gas constants
const DEFAULT_GAS = "30000000000000" // 30 TGas
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
    // Common SputnikDAO errors
    if (error.message.includes("ERR_PERMISSION_DENIED")) {
      return "You don't have permission to perform this action"
    }
    if (error.message.includes("ERR_WRONG_KIND")) {
      return "Proposal kind mismatch - please refresh and try again"
    }
    if (error.message.includes("ERR_PROPOSAL_NOT_READY_FOR_VOTE")) {
      return "Proposal is not ready for voting"
    }
    return error.message
  }
  return "Transaction failed"
}

export interface UseSputnikDaoResult {
  /** Vote on a proposal */
  vote: (proposalId: number, action: SputnikAction, proposalKind: SputnikProposalKind, memo?: string) => Promise<void>
  /** Finalize a proposal after voting period */
  finalize: (proposalId: number, proposalKind: SputnikProposalKind) => Promise<void>
  /** Loading state for transaction operations */
  isLoading: boolean
  /** Error message from last operation */
  error: string | null
  /** Clear the current error */
  clearError: () => void
}

/**
 * React hook for SputnikDAO voting actions that require wallet signing.
 * All operations are signed by the connected user's wallet.
 *
 * IMPORTANT: Users vote directly on SputnikDAO - NOT through the bridge.
 * The proposalKind parameter MUST match the stored proposal's kind exactly,
 * otherwise SputnikDAO will reject with ERR_WRONG_KIND.
 *
 * Usage:
 * ```tsx
 * const { vote, finalize, isLoading, error } = useSputnikDao()
 *
 * // Vote on a proposal (pass the exact proposalKind from getProposal)
 * await vote(proposalId, "VoteApprove", proposal.kind)
 *
 * // Finalize after voting period ends
 * await finalize(proposalId, proposal.kind)
 * ```
 */
export function useSputnikDao(): UseSputnikDaoResult {
  const { signAndSendTransaction, isConnected } = useNearWallet()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const clearError = useCallback(() => setError(null), [])

  const vote = useCallback(
    async (
      proposalId: number,
      action: SputnikAction,
      proposalKind: SputnikProposalKind,
      memo?: string,
    ): Promise<void> => {
      if (!isConnected) {
        throw new Error("Wallet not connected")
      }

      if (!NEAR_CONFIG.sputnikDaoContractId) {
        throw new Error("SputnikDAO contract ID not configured")
      }

      setIsLoading(true)
      setError(null)

      try {
        await signAndSendTransaction({
          receiverId: NEAR_CONFIG.sputnikDaoContractId,
          actions: [
            {
              type: "FunctionCall",
              params: {
                methodName: "act_proposal",
                args: {
                  id: proposalId,
                  action,
                  proposal: proposalKind, // MUST match stored proposal kind
                  memo: memo ?? null,
                },
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

  const finalize = useCallback(
    async (proposalId: number, proposalKind: SputnikProposalKind): Promise<void> => {
      if (!isConnected) {
        throw new Error("Wallet not connected")
      }

      if (!NEAR_CONFIG.sputnikDaoContractId) {
        throw new Error("SputnikDAO contract ID not configured")
      }

      setIsLoading(true)
      setError(null)

      try {
        await signAndSendTransaction({
          receiverId: NEAR_CONFIG.sputnikDaoContractId,
          actions: [
            {
              type: "FunctionCall",
              params: {
                methodName: "act_proposal",
                args: {
                  id: proposalId,
                  action: "Finalize",
                  proposal: proposalKind,
                  memo: null,
                },
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

  return {
    vote,
    finalize,
    isLoading,
    error,
    clearError,
  }
}
