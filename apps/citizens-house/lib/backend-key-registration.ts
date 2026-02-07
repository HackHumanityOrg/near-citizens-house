/**
 * Backend Key Registration at Startup
 *
 * Automatically registers the backend key pool on-chain during server startup.
 * Checks which keys are already registered and only adds missing ones.
 *
 * This module is designed to be called from instrumentation.ts, so it:
 * - Uses dynamic imports to avoid loading server-only modules prematurely
 * - Never blocks server startup (runs async, catches all errors)
 * - Is idempotent (safe to run multiple times)
 *
 * Key improvements:
 * - Batch registration: All missing keys in a single transaction (no nonce conflicts)
 * - Retry logic: Exponential backoff for transient failures
 * - Between-retry verification: Checks if keys exist before retrying
 * - Post-registration verification: Confirms keys were registered
 */
import * as Sentry from "@sentry/nextjs"

// Retry configuration
const MAX_RETRIES = 5
const BASE_DELAY_MS = 1000

/**
 * Sleep for a given number of milliseconds with optional jitter.
 */
function sleep(ms: number, jitter = 0): Promise<void> {
  const delay = ms + Math.random() * jitter
  return new Promise((resolve) => setTimeout(resolve, delay))
}

/**
 * Check if error indicates key already exists (success condition).
 */
function isAlreadyExistsError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error)
  return msg.includes("AddKeyAlreadyExists") || msg.includes("already exists") || msg.includes("already used")
}

/**
 * Check if error is retryable (transient failures).
 */
function isRetryableError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error)
  return (
    msg.includes("nonce") ||
    msg.includes("429") ||
    msg.includes("ECONNRESET") ||
    msg.includes("timeout") ||
    msg.includes("expired") ||
    msg.includes("Server error") ||
    msg.includes("Exceeded")
  )
}

/**
 * Ensure backend keys are registered on-chain.
 *
 * Called from instrumentation.ts on server startup.
 * Checks existing keys on-chain and registers any missing ones.
 * The blockchain is the source of truth - no external state needed.
 *
 * Error handling:
 * - If NEAR RPC fails: logs error (will retry next instance startup)
 * - Never throws - server startup must not be blocked
 */
export async function ensureBackendKeysRegistered(): Promise<void> {
  // Skip in development unless explicitly enabled
  if (process.env.NODE_ENV === "development" && !process.env.FORCE_KEY_REGISTRATION) {
    Sentry.logger.info("backend_key_registration_skipped", {
      reason: "development_mode",
      force_key_registration: Boolean(process.env.FORCE_KEY_REGISTRATION),
    })
    return
  }

  try {
    // Dynamic imports to avoid loading server modules at instrumentation time
    const { Account } = await import("@near-js/accounts")
    const { KeyPair } = await import("@near-js/crypto")
    const { KeyPairSigner } = await import("@near-js/signers")
    const { actionCreators } = await import("@near-js/transactions")
    const { NEAR_SERVER_CONFIG } = await import("./config.server")
    const { createRpcProvider, getRpcUrl, getRpcHeaders } = await import("./providers/rpc-provider")
    const { backendKeyPool } = await import("./backend-key-pool")

    const { backendAccountId, backendPrivateKey, networkId } = NEAR_SERVER_CONFIG

    if (!backendAccountId || !backendPrivateKey) {
      Sentry.logger.warn("backend_key_registration_missing_config", {
        has_backend_account_id: Boolean(backendAccountId),
        has_backend_private_key: Boolean(backendPrivateKey),
      })
      return
    }

    Sentry.logger.info("backend_key_registration_started", {
      backend_account_id: backendAccountId,
      network_id: networkId,
      max_retries: MAX_RETRIES,
    })

    const provider = createRpcProvider()
    const rpcUrl = getRpcUrl()
    const rpcHeaders = getRpcHeaders()

    /**
     * Query access key list from RPC.
     */
    async function queryAccessKeyList(): Promise<Set<string>> {
      const existingKeysResponse = await provider.query({
        request_type: "view_access_key_list",
        account_id: backendAccountId,
        finality: "final",
      })
      type AccessKeyList = import("./schemas/near").AccessKeyList
      return new Set((existingKeysResponse as unknown as AccessKeyList).keys.map((k) => k.public_key))
    }

    /**
     * Check if a single key exists on-chain via direct RPC query.
     */
    async function keyExistsOnChain(publicKeyStr: string): Promise<boolean> {
      try {
        const response = await fetch(rpcUrl, {
          method: "POST",
          headers: { ...rpcHeaders, "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: "check-key",
            method: "query",
            params: {
              request_type: "view_access_key",
              finality: "final",
              account_id: backendAccountId,
              public_key: publicKeyStr,
            },
          }),
        })
        const data = await response.json()
        return !data.error && data.result?.permission
      } catch (error) {
        Sentry.logger.warn("backend_key_registration_key_exists_check_failed", {
          backend_account_id: backendAccountId,
          public_key: publicKeyStr,
          error_message: error instanceof Error ? error.message : String(error),
        })
        return false
      }
    }

    // Get all keys currently registered on the account
    const existingKeys = await queryAccessKeyList()

    // Check which pool keys need to be registered
    const poolKeys = backendKeyPool.getAllPublicKeys()
    let missingKeys: { index: number; publicKey: string }[] = []

    for (let i = 0; i < poolKeys.length; i++) {
      if (!existingKeys.has(poolKeys[i])) {
        missingKeys.push({ index: i, publicKey: poolKeys[i] })
      }
    }

    if (missingKeys.length === 0) {
      Sentry.logger.info("backend_key_registration_already_complete", {
        backend_account_id: backendAccountId,
        total_pool_keys: poolKeys.length,
      })
      return
    }

    Sentry.logger.info("backend_key_registration_missing_keys_detected", {
      backend_account_id: backendAccountId,
      total_pool_keys: poolKeys.length,
      missing_key_count: missingKeys.length,
    })

    // Create account with master key for adding new keys
    const masterKeyPair = KeyPair.fromString(backendPrivateKey as `ed25519:${string}`)
    const signer = new KeyPairSigner(masterKeyPair)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const account = new Account(backendAccountId, provider, signer as any)

    // Retry loop with exponential backoff
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        // Build batch transaction with all missing keys
        const actions = missingKeys.map(({ index }) => {
          const derivedKey = backendKeyPool.getKeyByIndex(index)
          return actionCreators.addKey(derivedKey.getPublicKey(), actionCreators.fullAccessKey())
        })

        // Execute batch transaction
        await account.signAndSendTransaction({
          receiverId: backendAccountId,
          actions,
        })

        Sentry.logger.info("backend_key_registration_batch_success", {
          backend_account_id: backendAccountId,
          registered_key_count: missingKeys.length,
          attempt,
        })
        break
      } catch (error: unknown) {
        // If some keys already exist, re-check which are still missing
        if (isAlreadyExistsError(error)) {
          Sentry.logger.warn("backend_key_registration_race_detected", {
            backend_account_id: backendAccountId,
            attempt,
            error_message: error instanceof Error ? error.message : String(error),
          })

          // Re-query to see current state
          const currentKeys = await queryAccessKeyList()
          missingKeys = missingKeys.filter(({ publicKey }) => !currentKeys.has(publicKey))

          if (missingKeys.length === 0) {
            Sentry.logger.info("backend_key_registration_race_resolved", {
              backend_account_id: backendAccountId,
              attempt,
            })
            break
          }

          // Still have missing keys - continue retry loop with remaining keys
          Sentry.logger.warn("backend_key_registration_keys_still_missing", {
            backend_account_id: backendAccountId,
            attempt,
            missing_key_count: missingKeys.length,
          })
          if (attempt < MAX_RETRIES) {
            await sleep(BASE_DELAY_MS, 500)
            continue
          }
        }

        // Check if error is retryable
        if (isRetryableError(error) && attempt < MAX_RETRIES) {
          const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1)
          Sentry.logger.warn("backend_key_registration_retry_scheduled", {
            backend_account_id: backendAccountId,
            attempt,
            max_retries: MAX_RETRIES,
            retry_delay_ms: delay,
            error_message: error instanceof Error ? error.message : String(error),
          })
          await sleep(delay, 500)

          // Before retrying, check if keys now exist (another instance may have registered them)
          const allExist = await Promise.all(missingKeys.map(({ publicKey }) => keyExistsOnChain(publicKey)))
          if (allExist.every(Boolean)) {
            Sentry.logger.info("backend_key_registration_completed_by_other_instance", {
              backend_account_id: backendAccountId,
              attempt,
            })
            break
          }

          continue
        }

        // Non-retryable error or max retries exceeded
        const errorMessage = error instanceof Error ? error.message : String(error)
        Sentry.captureException(error, {
          tags: { area: "backend-key-registration" },
          extra: {
            backendAccountId,
            networkId,
            attempt,
            maxRetries: MAX_RETRIES,
            missingKeyCount: missingKeys.length,
          },
        })
        Sentry.logger.error("backend_key_registration_failed", {
          backend_account_id: backendAccountId,
          network_id: networkId,
          attempt,
          max_retries: MAX_RETRIES,
          missing_key_count: missingKeys.length,
          error_message: errorMessage,
        })
        return
      }
    }

    // Post-registration verification
    const existingKeysAfter = await queryAccessKeyList()
    const stillMissing = poolKeys.filter((pk) => !existingKeysAfter.has(pk))
    if (stillMissing.length > 0) {
      Sentry.logger.warn("backend_key_registration_partial_completion", {
        backend_account_id: backendAccountId,
        total_pool_keys: poolKeys.length,
        still_missing_key_count: stillMissing.length,
      })
    } else {
      Sentry.logger.info("backend_key_registration_verified", {
        backend_account_id: backendAccountId,
        total_pool_keys: poolKeys.length,
      })
    }
  } catch (error) {
    // Never throw - instrumentation must not block server startup
    Sentry.captureException(error, {
      tags: { area: "backend-key-registration-bootstrap" },
    })
    Sentry.logger.error("backend_key_registration_bootstrap_failed", {
      error_message: error instanceof Error ? error.message : String(error),
    })
  }
}
