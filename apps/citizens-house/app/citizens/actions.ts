"use server"

import { unstable_cache } from "next/cache"
import {
  parseUserContextData,
  verifyNearSignature,
  buildProofData,
  getSigningMessage,
  getSigningRecipient,
  nearAccountIdSchema,
  type NearAccountId,
  type Verification,
  type ProofData,
} from "@/lib"
import { verifyStoredProofWithDetails } from "@/lib/zk-verify"
import { verificationDb } from "@/lib/contracts/verification/client"
import { paginationSchema, type Pagination } from "@/lib/schemas/core"
import { createGetVerificationsContext, createCheckIsVerifiedContext } from "@/lib/logger"
import type { RequestContext } from "@/lib/logger"
import type { GetVerificationsEvent } from "@/lib/logger/types"

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
async function fetchAndVerifyVerifications(
  pagination: Pagination,
  ctx?: RequestContext<GetVerificationsEvent>,
): Promise<GetVerificationsResult> {
  // Get paginated accounts from NEAR contract (newest first)
  ctx?.startTimer("contractFetch")
  const { accounts, total } = await verificationDb.listVerificationsNewestFirst(pagination)
  ctx?.endTimer("contractFetch")

  ctx?.set("totalVerifications", total)
  ctx?.set("verificationsReturned", accounts.length)

  // Track verification counts
  let zkAttempted = 0
  let zkSucceeded = 0
  let zkFailed = 0
  let sigAttempted = 0
  let sigSucceeded = 0
  let sigFailed = 0

  // Verify each account in parallel
  ctx?.startTimer("zkVerification")
  const verifiedAccounts = await Promise.all(
    accounts.map(async (account): Promise<VerificationWithStatus> => {
      try {
        // Re-verification attempt with graceful error handling
        let zkResult
        zkAttempted++
        try {
          // 1. Verify ZK proof via Celo on-chain verifier
          zkResult = await verifyStoredProofWithDetails(
            {
              proof: account.selfProof.proof,
              publicSignals: account.selfProof.publicSignals,
            },
            account.attestationId,
          )
          if (zkResult.isValid) {
            zkSucceeded++
          } else {
            zkFailed++
          }
        } catch (error) {
          zkFailed++
          // Graceful degradation: RPC failed but account is verified by contract
          zkResult = {
            isValid: false, // Mark as not re-verified (but don't fail)
            publicSignalsCount: account.selfProof.publicSignals.length,
            error: error instanceof Error ? error.message : "RPC verification unavailable",
          }
        }

        // 2. Verify NEAR signature
        sigAttempted++
        const sigData = parseUserContextData(account.userContextData)
        let signatureValid = false
        let signatureError: string | undefined

        if (sigData) {
          const signatureChallenge = sigData.challenge || getSigningMessage()
          const signatureRecipient = sigData.recipient ?? getSigningRecipient()

          const sigResult = verifyNearSignature(
            signatureChallenge,
            sigData.signature,
            sigData.publicKey,
            sigData.nonce,
            signatureRecipient,
          )
          signatureValid = sigResult.valid
          if (sigResult.valid) {
            sigSucceeded++
          } else {
            sigFailed++
            signatureError = sigResult.error
          }
        } else {
          sigFailed++
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
        zkFailed++
        sigFailed++
        // Final catch-all: Always display account even if verification completely fails
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
  ctx?.endTimer("zkVerification")

  // Set verification stats
  ctx?.set("zkVerificationAttempted", zkAttempted)
  ctx?.set("zkVerificationSucceeded", zkSucceeded)
  ctx?.set("zkVerificationFailed", zkFailed)
  ctx?.set("signatureVerificationAttempted", sigAttempted)
  ctx?.set("signatureVerificationSucceeded", sigSucceeded)
  ctx?.set("signatureVerificationFailed", sigFailed)

  return { accounts: verifiedAccounts, total }
}

/**
 * Cached version of fetchAndVerifyVerifications.
 * Cache is tagged with 'verifications' for on-demand revalidation.
 * Note: Cache doesn't accept ctx, so logging happens in the wrapper.
 */
const getCachedVerifications = unstable_cache(
  (pagination: Pagination) => fetchAndVerifyVerifications(pagination),
  ["verifications"],
  {
    tags: ["verifications"],
    revalidate: 60, // Revalidate every 60 seconds (1 minute)
  },
)

/**
 * Server action to get verifications with re-verification status.
 * Uses unstable_cache for caching with 1-minute revalidation.
 * All verification (ZK proof via Celo + NEAR signature) happens server-side.
 */
export async function getVerificationsWithStatus(page: number, pageSize: number): Promise<GetVerificationsResult> {
  const ctx = createGetVerificationsContext()
  ctx.setMany({
    action: "getVerificationsWithStatus",
    page,
    pageSize,
    verificationsRequested: pageSize,
  })

  // Validate input parameters with safeParse
  const params = paginationSchema.safeParse({ page, pageSize })
  if (!params.success) {
    ctx.set("outcome", "validation_error")
    ctx.emit("warn")
    return { accounts: [], total: 0 }
  }

  try {
    ctx.startTimer("contractFetch")
    const result = await getCachedVerifications(params.data)
    ctx.endTimer("contractFetch")

    ctx.set("verificationsReturned", result.accounts.length)
    ctx.set("totalVerifications", result.total)

    // Count verification results
    let zkSucceeded = 0
    let sigSucceeded = 0
    for (const v of result.accounts) {
      if (v.verification.zkValid) zkSucceeded++
      if (v.verification.signatureValid) sigSucceeded++
    }
    ctx.set("zkVerificationSucceeded", zkSucceeded)
    ctx.set("signatureVerificationSucceeded", sigSucceeded)
    ctx.set("outcome", "success")
    ctx.emit("info")

    return result
  } catch {
    ctx.set("outcome", "error")
    ctx.emit("error")
    // RPC failed - return empty without caching
    // Next request will retry immediately instead of waiting 60s
    return { accounts: [], total: 0 }
  }
}

/**
 * Server action to check if a NEAR account is already verified.
 * Used by the UI to skip verification steps for already-verified accounts.
 */
export async function checkIsVerified(nearAccountId: NearAccountId): Promise<boolean> {
  const ctx = createCheckIsVerifiedContext()
  ctx.setMany({
    action: "checkIsVerified",
    nearAccountId,
  })

  // Runtime validation for security (server actions can receive arbitrary input)
  const parsed = nearAccountIdSchema.safeParse(nearAccountId)
  if (!parsed.success) {
    ctx.set("outcome", "validation_error")
    ctx.emit("warn")
    return false
  }

  try {
    ctx.startTimer("contractCall")
    const isVerified = await verificationDb.isVerified(parsed.data)
    ctx.endTimer("contractCall")

    ctx.set("isVerified", isVerified)
    ctx.set("outcome", isVerified ? "verified" : "not_verified")
    ctx.emit("info")

    return isVerified
  } catch {
    ctx.set("outcome", "error")
    ctx.emit("error")
    return false
  }
}
