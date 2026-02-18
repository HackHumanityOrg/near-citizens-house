"use server"

import { unstable_cache } from "next/cache"
import {
  NEAR_CONFIG,
  parseUserContextData,
  verifyNearSignature,
  buildSignatureVerificationData,
  getSigningMessage,
  getSigningRecipient,
  nearAccountIdSchema,
  type NearAccountId,
} from "@/lib"
import type { TransformedVerification, TransformedVerificationSummary } from "@/lib/schemas/verification-contract"
import { verificationDb } from "@/lib/contracts/verification/client"
import { governanceReader } from "@/lib/contracts/governance/client"
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

async function fetchBlocklist(): Promise<string[]> {
  if (!NEAR_CONFIG.governanceContractId) return []

  const BATCH = 100
  const all: string[] = []
  let fromIndex = 0

  while (true) {
    const batch = await governanceReader.listBlocklist(fromIndex, BATCH)
    all.push(...batch)
    if (batch.length < BATCH) break
    fromIndex += batch.length
  }

  return all
}

const getCachedBlocklist = unstable_cache(
  () => fetchBlocklist(),
  ["citizens-blocklist", NEAR_CONFIG.governanceContractId ?? ""],
  { tags: ["governance"], revalidate: 60 },
)

async function verifyAccountSignatures(accounts: TransformedVerification[]): Promise<VerificationWithStatus[]> {
  return Promise.all(
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
}

async function countVerifiedBlocklistedAccounts(blocklistSet: ReadonlySet<string>): Promise<number> {
  if (blocklistSet.size === 0) return 0

  const checks = await Promise.all(
    [...blocklistSet].map((id) => verificationDb.isVerified(id as NearAccountId).catch(() => false)),
  )
  return checks.filter(Boolean).length
}

async function listNonBlocklistedPage(
  pagination: Pagination,
  blocklistSet: ReadonlySet<string>,
): Promise<{ accounts: TransformedVerification[]; totalUnfiltered: number }> {
  const BATCH = 100
  const filteredOffset = pagination.page * pagination.pageSize
  const pageAccounts: TransformedVerification[] = []
  let nonBlocklistedSeen = 0
  let scanPage = 0
  let totalUnfiltered = 0

  while (true) {
    const { accounts: batch, total } = await verificationDb.listVerificationsNewestFirst({
      page: scanPage,
      pageSize: BATCH,
    })

    if (scanPage === 0) {
      totalUnfiltered = total
      if (totalUnfiltered === 0) {
        return { accounts: [], totalUnfiltered }
      }
    }

    if (batch.length === 0) {
      break
    }

    for (const account of batch) {
      if (blocklistSet.has(account.nearAccountId)) {
        continue
      }

      if (nonBlocklistedSeen >= filteredOffset && pageAccounts.length < pagination.pageSize) {
        pageAccounts.push(account)
      }
      nonBlocklistedSeen += 1

      if (pageAccounts.length === pagination.pageSize) {
        return { accounts: pageAccounts, totalUnfiltered }
      }
    }

    scanPage += 1
    if (scanPage * BATCH >= totalUnfiltered) {
      break
    }
  }

  return { accounts: pageAccounts, totalUnfiltered }
}

/**
 * Core data fetching logic - separated for caching.
 * Fetches accounts from NEAR contract and verifies NEAR signatures.
 * SumSub handles identity verification; we verify signature integrity.
 */
async function fetchAndVerifyVerifications(pagination: Pagination): Promise<GetVerificationsResult> {
  const blocklist = await getCachedBlocklist().catch(() => [] as string[])
  const blocklistSet = new Set(blocklist)

  if (blocklistSet.size === 0) {
    const { accounts, total } = await verificationDb.listVerificationsNewestFirst(pagination)
    const verifiedAccounts = await verifyAccountSignatures(accounts)
    return { accounts: verifiedAccounts, total }
  }

  // Fill pages from blocklist-filtered data (filter first, then paginate)
  const [{ accounts, totalUnfiltered }, verifiedBlocklistedCount] = await Promise.all([
    listNonBlocklistedPage(pagination, blocklistSet),
    countVerifiedBlocklistedAccounts(blocklistSet),
  ])
  const verifiedAccounts = await verifyAccountSignatures(accounts)

  return {
    accounts: verifiedAccounts,
    total: Math.max(0, totalUnfiltered - verifiedBlocklistedCount),
  }
}

/**
 * Cached version of fetchAndVerifyVerifications.
 * Cache is tagged with 'verifications' for on-demand revalidation.
 */
const getCachedVerifications = unstable_cache(
  (pagination: Pagination) => fetchAndVerifyVerifications(pagination),
  ["verifications", NEAR_CONFIG.verificationContractId],
  {
    tags: ["verifications", "governance"],
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

/**
 * Server action to fetch a verification summary (including verifiedAt).
 * Used by governance UI to determine proposal-time voting eligibility.
 */
export async function getVerificationSummary(
  nearAccountId: NearAccountId,
): Promise<TransformedVerificationSummary | null> {
  const parsed = nearAccountIdSchema.safeParse(nearAccountId)
  if (!parsed.success) {
    return null
  }

  try {
    return await verificationDb.getVerification(parsed.data)
  } catch {
    return null
  }
}
