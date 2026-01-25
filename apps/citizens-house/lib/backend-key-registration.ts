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
 */

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
    const { NEAR_SERVER_CONFIG } = await import("./config.server")
    const { createRpcProvider } = await import("./providers/rpc-provider")
    const { backendKeyPool } = await import("./backend-key-pool")

    const { backendAccountId, backendPrivateKey, networkId } = NEAR_SERVER_CONFIG

    if (!backendAccountId || !backendPrivateKey) {
      console.warn("[BackendKeyRegistration] NEAR_ACCOUNT_ID or NEAR_PRIVATE_KEY not configured, skipping")
      return
    }

    console.log(`[BackendKeyRegistration] Checking keys for ${backendAccountId} on ${networkId}...`)

    const provider = createRpcProvider()

    // Get all keys currently registered on the account
    const existingKeysResponse = await provider.query({
      request_type: "view_access_key_list",
      account_id: backendAccountId,
      finality: "final",
    })

    // Extract public key strings from the response
    type AccessKeyList = import("./schemas/near").AccessKeyList
    const existingKeys = new Set((existingKeysResponse as unknown as AccessKeyList).keys.map((k) => k.public_key))

    // Check which pool keys need to be registered
    const poolKeys = backendKeyPool.getAllPublicKeys()
    const missingKeys: { index: number; publicKey: string }[] = []

    for (let i = 0; i < poolKeys.length; i++) {
      if (!existingKeys.has(poolKeys[i])) {
        missingKeys.push({ index: i, publicKey: poolKeys[i] })
      }
    }

    if (missingKeys.length === 0) {
      console.log(`[BackendKeyRegistration] All ${poolKeys.length} keys already registered`)
      return
    }

    console.log(`[BackendKeyRegistration] Registering ${missingKeys.length} missing keys...`)

    // Create account with master key for adding new keys
    const masterKeyPair = KeyPair.fromString(backendPrivateKey as `ed25519:${string}`)
    const signer = new KeyPairSigner(masterKeyPair)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const account = new Account(backendAccountId, provider, signer as any)

    let added = 0
    let failed = 0

    for (const { index, publicKey } of missingKeys) {
      const derivedKey = backendKeyPool.getKeyByIndex(index)
      const shortKey = publicKey.slice(0, 20) + "..."

      try {
        await account.addFullAccessKey(derivedKey.getPublicKey())
        console.log(`[BackendKeyRegistration] Key ${index}: ${shortKey} - Added`)
        added++
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error)

        // Key already exists = success (race condition with another instance)
        if (
          errorMessage.includes("AddKeyAlreadyExists") ||
          errorMessage.includes("already exists") ||
          errorMessage.includes("already used")
        ) {
          console.log(`[BackendKeyRegistration] Key ${index}: ${shortKey} - Already registered (race)`)
          added++
        } else {
          console.error(`[BackendKeyRegistration] Key ${index}: ${shortKey} - Failed: ${errorMessage}`)
          failed++
        }
      }
    }

    console.log(`[BackendKeyRegistration] Complete: ${added} added, ${failed} failed`)
  } catch (error) {
    // Never throw - instrumentation must not block server startup
    console.error("[BackendKeyRegistration] Error:", error instanceof Error ? error.message : error)
  }
}
