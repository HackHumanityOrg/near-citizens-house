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
    console.log("[BackendKeyRegistration] Skipping in development mode")
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
      console.warn("[BackendKeyRegistration] NEAR_ACCOUNT_ID or NEAR_PRIVATE_KEY not configured, skipping")
      return
    }

    console.log(`[BackendKeyRegistration] Checking keys for ${backendAccountId} on ${networkId}...`)

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
      } catch {
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
      console.log(`[BackendKeyRegistration] All ${poolKeys.length} keys already registered`)
      return
    }

    console.log(`[BackendKeyRegistration] Registering ${missingKeys.length} missing keys in batch...`)

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

        console.log(`[BackendKeyRegistration] Batch registration successful (${missingKeys.length} keys)`)
        break
      } catch (error: unknown) {
        // If some keys already exist, re-check which are still missing
        if (isAlreadyExistsError(error)) {
          console.log(`[BackendKeyRegistration] Some keys already exist, re-checking...`)

          // Re-query to see current state
          const currentKeys = await queryAccessKeyList()
          missingKeys = missingKeys.filter(({ publicKey }) => !currentKeys.has(publicKey))

          if (missingKeys.length === 0) {
            console.log(`[BackendKeyRegistration] All keys now registered (race condition resolved)`)
            break
          }

          // Still have missing keys - continue retry loop with remaining keys
          console.log(`[BackendKeyRegistration] ${missingKeys.length} keys still missing, retrying...`)
          if (attempt < MAX_RETRIES) {
            await sleep(BASE_DELAY_MS, 500)
            continue
          }
        }

        // Check if error is retryable
        if (isRetryableError(error) && attempt < MAX_RETRIES) {
          const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1)
          console.log(`[BackendKeyRegistration] Attempt ${attempt}/${MAX_RETRIES} failed, retrying in ${delay}ms...`)
          await sleep(delay, 500)

          // Before retrying, check if keys now exist (another instance may have registered them)
          const allExist = await Promise.all(missingKeys.map(({ publicKey }) => keyExistsOnChain(publicKey)))
          if (allExist.every(Boolean)) {
            console.log(`[BackendKeyRegistration] Keys now exist (registered by another instance)`)
            break
          }

          continue
        }

        // Non-retryable error or max retries exceeded
        const errorMessage = error instanceof Error ? error.message : String(error)
        console.error(`[BackendKeyRegistration] Failed after ${attempt} attempts: ${errorMessage}`)
        return
      }
    }

    // Post-registration verification
    const existingKeysAfter = await queryAccessKeyList()
    const stillMissing = poolKeys.filter((pk) => !existingKeysAfter.has(pk))
    if (stillMissing.length > 0) {
      console.warn(`[BackendKeyRegistration] Warning: ${stillMissing.length} keys may not be registered yet`)
    } else {
      console.log(`[BackendKeyRegistration] Verified: all ${poolKeys.length} keys registered`)
    }
  } catch (error) {
    // Never throw - instrumentation must not block server startup
    console.error("[BackendKeyRegistration] Error:", error instanceof Error ? error.message : error)
  }
}
