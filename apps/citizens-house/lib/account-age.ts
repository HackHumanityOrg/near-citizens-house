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
import { ACCOUNT_AGE_CONFIG, NEAR_CONFIG } from "@near-citizens/shared"
import { logger, Op } from "./logger"

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
  // Skip account age check on testnet (no BigQuery data available for testnet)
  if (NEAR_CONFIG.networkId === "testnet") {
    return {
      allowed: true,
      reason: "Testnet - account age check skipped",
    }
  }

  const cacheKey = getAccountCreationCacheKey(accountId)

  // Try to get Redis client, but don't fail if unavailable
  let client: Awaited<ReturnType<typeof getRedisClient>> | null = null
  try {
    client = await getRedisClient()
  } catch (error) {
    logger.warn("Redis unavailable, falling back to BigQuery", {
      operation: Op.REDIS.CONNECT,
      error_message: error instanceof Error ? error.message : String(error),
    })
  }

  // Check cache first (if Redis available)
  let creationInfo: CachedAccountCreation | null = null

  if (client) {
    try {
      const cachedData = await client.get(cacheKey)
      if (cachedData) {
        creationInfo = JSON.parse(cachedData) as CachedAccountCreation
        logger.debug("Account creation cache hit", {
          operation: Op.ACCOUNT_AGE.CACHE_READ,
          account_id: accountId,
          created_at: creationInfo.createdAt,
          cache_hit: true,
        })
      }
    } catch (error) {
      logger.warn("Cache read failed", {
        operation: Op.ACCOUNT_AGE.CACHE_READ,
        account_id: accountId,
        error_message: error instanceof Error ? error.message : String(error),
      })
    }
  }

  if (!creationInfo) {
    // Fetch from BigQuery
    logger.debug("Account creation cache miss, querying BigQuery", {
      operation: Op.ACCOUNT_AGE.CACHE_READ,
      account_id: accountId,
      cache_hit: false,
    })
    const queryResult = await getAccountCreationDate(accountId)

    if (!queryResult.success) {
      if (queryResult.error === "genesis_account") {
        // Genesis accounts are allowed - they're the most established accounts
        creationInfo = {
          createdAt: null,
          fetchedAt: Date.now(),
          isGenesis: true,
        }
        logger.info("Genesis account detected", {
          operation: Op.ACCOUNT_AGE.CHECK,
          account_id: accountId,
          is_genesis: true,
          allowed: true,
        })
      } else {
        // Query failed or account not found - reject verification (fail closed)
        logger.error("Failed to fetch account info", {
          operation: Op.ACCOUNT_AGE.QUERY,
          account_id: accountId,
          error_type: queryResult.error,
          error_message: queryResult.message,
        })
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
        logger.debug("Cached account creation info", {
          operation: Op.ACCOUNT_AGE.CACHE_WRITE,
          account_id: accountId,
        })
      } catch (error) {
        logger.warn("Cache write failed", {
          operation: Op.ACCOUNT_AGE.CACHE_WRITE,
          account_id: accountId,
          error_message: error instanceof Error ? error.message : String(error),
        })
      }
    }
  }

  // Genesis accounts are allowed - they're the most established
  if (creationInfo.isGenesis || creationInfo.createdAt === null) {
    logger.info("Genesis account allowed", {
      operation: Op.ACCOUNT_AGE.CHECK,
      account_id: accountId,
      is_genesis: true,
      allowed: true,
    })
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

  logger.info("Account age calculated", {
    operation: Op.ACCOUNT_AGE.CHECK,
    account_id: accountId,
    account_age_days: accountAgeDays,
    created_at: new Date(creationInfo.createdAt).toISOString(),
  })

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
