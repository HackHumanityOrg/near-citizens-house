/**
 * Account age verification with Redis caching
 * Checks if a NEAR account is at least 30 days old
 *
 * This is a Sybil resistance measure - prevents users from creating
 * new accounts just for verification. Established accounts are more
 * likely to be legitimate.
 *
 * Uses NEAR BigQuery public dataset for account creation date lookup.
 */

import { getRedisClient } from "./redis"
import { getAccountCreationDate } from "./bigquery"
import { ACCOUNT_AGE_CONFIG } from "@near-citizens/shared"

function getAccountCreationCacheKey(accountId: string): string {
  return `account-creation:${accountId}`
}

/**
 * Cached account creation data
 */
interface CachedAccountCreation {
  createdAt: number | null // milliseconds since epoch, null if unknown/genesis
  fetchedAt: number // when we fetched this data from BigQuery
  isGenesis: boolean // true if account is a genesis account
}

/**
 * Result of account age check
 */
export interface AccountAgeCheckResult {
  allowed: boolean
  reason?: string
  createdAt?: number | null
  accountAgeDays?: number
}

/**
 * Check if account meets the minimum age requirement (at least 30 days old)
 *
 * @param accountId - NEAR account ID to check
 * @returns Result indicating if verification is allowed based on account age
 *
 * Rejection cases:
 * - BigQuery query fails - fail closed, reject verification
 * - Account not found in blockchain data - reject
 * - Account created less than 30 days ago - reject (too new)
 *
 * Allowed cases:
 * - Account is a genesis account (created at network launch) - allowed
 * - Account created 30+ days ago - allowed
 */
export async function checkAccountAge(accountId: string): Promise<AccountAgeCheckResult> {
  const cacheKey = getAccountCreationCacheKey(accountId)

  // Try to get Redis client, but don't fail if unavailable
  let client: Awaited<ReturnType<typeof getRedisClient>> | null = null
  try {
    client = await getRedisClient()
  } catch (error) {
    console.warn("[AccountAge] Redis unavailable, falling back to BigQuery:", error)
  }

  // Check cache first (if Redis available)
  let creationInfo: CachedAccountCreation | null = null

  if (client) {
    try {
      const cachedData = await client.get(cacheKey)
      if (cachedData) {
        creationInfo = JSON.parse(cachedData) as CachedAccountCreation
        console.log(`[AccountAge] Cache hit for ${accountId}, createdAt: ${creationInfo.createdAt}`)
      }
    } catch (error) {
      console.warn("[AccountAge] Cache read failed:", error)
    }
  }

  if (!creationInfo) {
    // Fetch from BigQuery
    console.log(`[AccountAge] Cache miss for ${accountId}, querying BigQuery`)
    const queryResult = await getAccountCreationDate(accountId)

    if (!queryResult.success) {
      if (queryResult.error === "genesis_account") {
        // Genesis accounts are allowed - they're the most established accounts
        creationInfo = {
          createdAt: null,
          fetchedAt: Date.now(),
          isGenesis: true,
        }
        console.log(`[AccountAge] Account ${accountId} is a genesis account - allowed`)
      } else {
        // Query failed or account not found - reject verification (fail closed)
        console.error(`[AccountAge] Failed to fetch account info for ${accountId}:`, queryResult.error)
        return {
          allowed: false,
          reason: queryResult.error === "not_found" ? "Account not found" : "Unable to verify account age",
        }
      }
    } else {
      creationInfo = {
        createdAt: queryResult.createdAt.getTime(),
        fetchedAt: Date.now(),
        isGenesis: false,
      }
    }

    // Best-effort cache write (account creation date never changes)
    if (client) {
      try {
        await client.set(cacheKey, JSON.stringify(creationInfo), {
          EX: ACCOUNT_AGE_CONFIG.cacheTimeoutSeconds,
        })
        console.log(`[AccountAge] Cached creation info for ${accountId}`)
      } catch (error) {
        console.warn("[AccountAge] Cache write failed:", error)
      }
    }
  }

  // Genesis accounts are allowed - they're the most established
  if (creationInfo.isGenesis || creationInfo.createdAt === null) {
    console.log(`[AccountAge] Account ${accountId} is a genesis account - allowed`)
    return {
      allowed: true,
      reason: "Genesis account",
      createdAt: null,
    }
  }

  // Calculate account age
  const now = Date.now()
  const accountAgeMs = now - creationInfo.createdAt
  const accountAgeDays = Math.floor(accountAgeMs / (24 * 60 * 60 * 1000))

  console.log(
    `[AccountAge] Account ${accountId} created ${accountAgeDays} days ago (${new Date(creationInfo.createdAt).toISOString()})`,
  )

  // Check if account meets minimum age requirement
  if (accountAgeMs < ACCOUNT_AGE_CONFIG.minAccountAgeMs) {
    const minAgeDays = Math.ceil(ACCOUNT_AGE_CONFIG.minAccountAgeMs / (24 * 60 * 60 * 1000))
    return {
      allowed: false,
      reason: `Account must be at least ${minAgeDays} days old`,
      createdAt: creationInfo.createdAt,
      accountAgeDays,
    }
  }

  return {
    allowed: true,
    createdAt: creationInfo.createdAt,
    accountAgeDays,
  }
}
