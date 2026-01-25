"use server"

import { unstable_cache } from "next/cache"
import {
  parseUserContextData,
  verifyNearSignature,
  buildSignatureVerificationData,
  getSigningMessage,
  getSigningRecipient,
  nearAccountIdSchema,
  type NearAccountId,
} from "@/lib"
import type { TransformedVerification } from "@/lib/schemas/verification-contract"
import { verificationDb } from "@/lib/contracts/verification/client"
import { paginationSchema, type Pagination } from "@/lib/schemas/core"
import { signatureVerificationDataSchema, type SignatureVerificationData } from "@/lib/schemas/verification-signature"

export type VerificationResult = {
  signatureValid: boolean
  error?: string
}

export type VerificationWithStatus = {
  account: TransformedVerification
  verification: VerificationResult
  signatureData: SignatureVerificationData | null
}

export type GetVerificationsResult = {
  accounts: VerificationWithStatus[]
  total: number
}

/**
 * Core data fetching logic - separated for caching.
 * Fetches accounts from NEAR contract and verifies NEAR signatures.
 * SumSub handles identity verification; we verify signature integrity.
 */
async function fetchAndVerifyVerifications(pagination: Pagination): Promise<GetVerificationsResult> {
  // Get paginated accounts from NEAR contract (newest first)
  const { accounts, total } = await verificationDb.listVerificationsNewestFirst(pagination)

  // Verify each account's NEAR signature in parallel
  const verifiedAccounts = await Promise.all(
    accounts.map(async (account): Promise<VerificationWithStatus> => {
      try {
        // Verify NEAR signature for data integrity
        const sigData = parseUserContextData(account.userContextData)
        let signatureValid = false
        let signatureError: string | undefined
        let signatureVerificationData: SignatureVerificationData | null = null

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
          if (!sigResult.valid) {
            signatureError = sigResult.error
          }

          // Build signature verification data for display
          if (signatureValid) {
            const verificationData = buildSignatureVerificationData(sigData)
            signatureVerificationData = signatureVerificationDataSchema.parse({
              ...verificationData,
              challenge: signatureChallenge,
              recipient: signatureRecipient,
              accountId: account.nearAccountId,
            })
          }
        } else {
          signatureError = "Could not parse signature data from userContextData"
        }

        return {
          account,
          verification: {
            signatureValid,
            error: signatureError,
          },
          signatureData: signatureVerificationData,
        }
      } catch (error) {
        // Final catch-all: Always display account even if verification fails
        return {
          account,
          verification: {
            signatureValid: false,
            error: error instanceof Error ? error.message : "Verification unavailable",
          },
          signatureData: null,
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
const getCachedVerifications = unstable_cache(
  (pagination: Pagination) => fetchAndVerifyVerifications(pagination),
  ["verifications"],
  {
    tags: ["verifications"],
    revalidate: 60, // Revalidate every 60 seconds (1 minute)
  },
)

/**
 * Server action to get verifications with status.
 * Uses unstable_cache for caching with 1-minute revalidation.
 * NEAR signature verification happens server-side.
 */
export async function getVerificationsWithStatus(page: number, pageSize: number): Promise<GetVerificationsResult> {
  // Validate input parameters with safeParse
  const params = paginationSchema.safeParse({ page, pageSize })
  if (!params.success) {
    return { accounts: [], total: 0 }
  }

  try {
    return await getCachedVerifications(params.data)
  } catch {
    return { accounts: [], total: 0 }
  }
}

/**
 * Server action to check if a NEAR account is already verified.
 * Used by the UI to skip verification steps for already-verified accounts.
 */
export async function checkIsVerified(nearAccountId: NearAccountId): Promise<boolean> {
  // Runtime validation for security (server actions can receive arbitrary input)
  const parsed = nearAccountIdSchema.safeParse(nearAccountId)
  if (!parsed.success) {
    return false
  }

  try {
    return await verificationDb.isVerified(parsed.data)
  } catch {
    return false
  }
}
