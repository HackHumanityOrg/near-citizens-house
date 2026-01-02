"use server"

import { z } from "zod"
import { unstable_cache } from "next/cache"
import {
  verificationDb,
  NearContractDatabase,
  verifyStoredProofWithDetails,
  parseUserContextData,
  verifyNearSignature,
  buildProofData,
  nearAccountIdSchema,
  type Verification,
  type ProofData,
} from "@near-citizens/shared"

const paginationSchema = z.object({
  page: z.number().int().min(0).max(100000),
  pageSize: z.number().int().min(1).max(100),
})

export type VerificationResult = {
  zkValid: boolean
  signatureValid: boolean
  error?: string
}

export type VerificationWithStatus = {
  account: Verification
  verification: VerificationResult
  proofData: ProofData | null
}

export type GetVerificationsResult = {
  accounts: VerificationWithStatus[]
  total: number
}

/**
 * Core data fetching logic - separated for caching.
 * Fetches accounts from NEAR contract and verifies each one.
 */
async function fetchAndVerifyVerifications(fromIndex: number, limit: number): Promise<GetVerificationsResult> {
  const nearDb = verificationDb as NearContractDatabase

  // Get paginated accounts from NEAR contract
  const { accounts, total } = await nearDb.listVerifications(fromIndex, limit)

  // Verify each account in parallel
  const verifiedAccounts = await Promise.all(
    accounts.map(async (account): Promise<VerificationWithStatus> => {
      try {
        // Re-verification attempt with graceful error handling
        let zkResult
        try {
          // 1. Verify ZK proof via Celo on-chain verifier
          zkResult = await verifyStoredProofWithDetails(
            {
              proof: account.selfProof.proof,
              publicSignals: account.selfProof.publicSignals,
            },
            Number(account.attestationId),
          )

          // Log successful verification with RPC endpoint used
          if (zkResult.isValid && zkResult.rpcUrl) {
            console.log(`[Verification] ZK proof verified for ${account.nearAccountId} via ${zkResult.rpcUrl}`)
          }
        } catch (error) {
          // Graceful degradation: RPC failed but account is verified by contract
          console.warn(
            `[Verification] ZK re-verification failed for ${account.nearAccountId}, but account is contract-verified:`,
            error instanceof Error ? error.message : error,
          )
          zkResult = {
            isValid: false, // Mark as not re-verified (but don't fail)
            publicSignalsCount: account.selfProof.publicSignals.length,
            error: error instanceof Error ? error.message : "RPC verification unavailable",
          }
        }

        // 2. Verify NEAR signature
        const sigData = parseUserContextData(account.userContextData)
        let signatureValid = false
        let signatureError: string | undefined

        if (sigData) {
          const sigResult = verifyNearSignature(
            "Identify myself",
            sigData.signature,
            sigData.publicKey,
            sigData.nonce,
            sigData.accountId,
          )
          signatureValid = sigResult.valid
          if (!sigResult.valid) {
            signatureError = sigResult.error
          }
        } else {
          signatureError = "Could not parse signature data from userContextData"
        }

        // 3. Build proof data for display
        const proofData = buildProofData(account, sigData)

        return {
          account: {
            nearAccountId: account.nearAccountId,
            nullifier: account.nullifier,
            attestationId: account.attestationId,
            verifiedAt: account.verifiedAt,
            selfProof: account.selfProof,
            userContextData: account.userContextData,
          },
          verification: {
            zkValid: zkResult.isValid,
            signatureValid,
            error: zkResult.error || signatureError,
          },
          proofData,
        }
      } catch (error) {
        // Final catch-all: Always display account even if verification completely fails
        console.error(
          `[Verification] Unexpected error verifying ${account.nearAccountId}:`,
          error instanceof Error ? error.message : error,
        )
        return {
          account: {
            nearAccountId: account.nearAccountId,
            nullifier: account.nullifier,
            attestationId: account.attestationId,
            verifiedAt: account.verifiedAt,
            selfProof: account.selfProof,
            userContextData: account.userContextData,
          },
          verification: {
            zkValid: false,
            signatureValid: false,
            error: error instanceof Error ? error.message : "Re-verification unavailable (contract-verified)",
          },
          proofData: null,
        }
      }
    }),
  )

  return { accounts: verifiedAccounts, total }
}

/**
 * Cached version of fetchAndVerifyVerifications.
 * Cache is tagged with 'verifications' for on-demand revalidation.
 */
const getCachedVerifications = unstable_cache(fetchAndVerifyVerifications, ["verifications"], {
  tags: ["verifications"],
  revalidate: 60, // Revalidate every 60 seconds (1 minute)
})

/**
 * Server action to get verifications with re-verification status.
 * Uses unstable_cache for caching with 1-minute revalidation.
 * All verification (ZK proof via Celo + NEAR signature) happens server-side.
 */
export async function getVerificationsWithStatus(page: number, pageSize: number): Promise<GetVerificationsResult> {
  // Validate input parameters with safeParse
  const params = paginationSchema.safeParse({ page, pageSize })
  if (!params.success) {
    console.error("[Actions] Invalid pagination:", z.treeifyError(params.error))
    return { accounts: [], total: 0 }
  }

  return getCachedVerifications(params.data.page * params.data.pageSize, params.data.pageSize)
}

/**
 * Server action to check if a NEAR account is already verified.
 * Used by the UI to skip verification steps for already-verified accounts.
 */
export async function checkIsVerified(nearAccountId: string): Promise<boolean> {
  // Validate account ID format
  const parsed = nearAccountIdSchema.safeParse(nearAccountId)
  if (!parsed.success) {
    console.error("[Actions] Invalid account ID:", z.treeifyError(parsed.error))
    return false
  }

  try {
    return await verificationDb.isVerified(parsed.data)
  } catch (error) {
    console.error("Error checking account verification:", error)
    return false
  }
}
