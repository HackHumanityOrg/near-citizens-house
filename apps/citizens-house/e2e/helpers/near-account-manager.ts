import { Account } from "@near-js/accounts"
import { KeyPair, KeyPairEd25519 } from "@near-js/crypto"
import type { KeyPairString } from "@near-js/crypto"
import { KeyPairSigner } from "@near-js/signers"
import { JsonRpcProvider } from "@near-js/providers"
import { actionCreators } from "@near-js/transactions"
import { deriveWorkerKey } from "./deterministic-keys"

// RPC URL configuration for E2E tests
// Uses FastNEAR for reliable transaction broadcasting (dRPC doesn't support transactions properly)
// Falls back to official RPC if FastNEAR is unavailable
function getRpcUrl(): string {
  // E2E tests need transaction support - use FastNEAR which reliably handles transactions
  // dRPC returns "Server error: undefined" for transaction broadcasts
  const networkId = process.env.NEXT_PUBLIC_NEAR_NETWORK || "testnet"
  return networkId === "mainnet" ? "https://free.rpc.fastnear.com" : "https://test.rpc.fastnear.com"
}

interface TestAccount {
  accountId: string
  publicKey: string
  privateKey: string // ed25519:... format
}

/**
 * Manages NEAR test subaccounts for E2E testing.
 *
 * Each Playwright worker gets its own deterministically-derived access key
 * on the parent account, eliminating nonce collisions during parallel test runs.
 *
 * Keys are derived from NEAR_PRIVATE_KEY + workerIndex, so they're:
 * - Deterministic: same seed + index = same key every run
 * - Reusable: once registered on the account, they persist forever
 * - Lazily registered: added to parent account on first use
 */
export class NearAccountManager {
  private provider: JsonRpcProvider
  private parentAccountId: string
  private parentSigner: KeyPairSigner // Original parent key for addKey operations
  private workerSigner: KeyPairSigner // Worker-specific key for account creation
  private workerKey: KeyPairEd25519
  private workerIndex: number
  private createdAccounts: TestAccount[] = []
  private workerKeyRegistered = false

  constructor(workerIndex: number) {
    this.workerIndex = workerIndex

    // Use RPC URL from env (respects NEXT_PUBLIC_NEAR_RPC_URL from Doppler)
    this.provider = new JsonRpcProvider({ url: getRpcUrl() })

    // Initialize parent account from Doppler env vars
    const parentAccountId = process.env.NEAR_ACCOUNT_ID
    const parentPrivateKey = process.env.NEAR_PRIVATE_KEY

    if (!parentAccountId || !parentPrivateKey) {
      throw new Error("NEAR_ACCOUNT_ID and NEAR_PRIVATE_KEY environment variables are required")
    }

    this.parentAccountId = parentAccountId

    // Parent signer for addKey operations (uses original NEAR_PRIVATE_KEY)
    const parentKeyPair = KeyPair.fromString(parentPrivateKey as KeyPairString)
    this.parentSigner = new KeyPairSigner(parentKeyPair)

    // Worker-specific key derived from parent key + worker index
    // Each worker gets its own key with independent nonce sequence
    this.workerKey = deriveWorkerKey(parentPrivateKey, workerIndex)
    this.workerSigner = new KeyPairSigner(this.workerKey)
  }

  /**
   * Checks if a key exists on the parent account (view call, no nonce needed)
   */
  private async keyExistsOnChain(publicKeyStr: string): Promise<boolean> {
    try {
      // Use RPC view call to check if key exists
      const response = await fetch(getRpcUrl(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: "check-key",
          method: "query",
          params: {
            request_type: "view_access_key",
            finality: "final",
            account_id: this.parentAccountId,
            public_key: publicKeyStr,
          },
        }),
      })
      const data = await response.json()
      // If key exists, result will have permission info; if not, error
      return !data.error && data.result?.permission
    } catch {
      return false
    }
  }

  /**
   * Ensures the worker's derived key is registered on the parent account.
   * This is idempotent - if the key already exists, it succeeds silently.
   *
   * Must be called once before creating subaccounts.
   */
  async ensureWorkerKeyExists(): Promise<void> {
    if (this.workerKeyRegistered) {
      return
    }

    const publicKey = this.workerKey.getPublicKey()
    const publicKeyStr = publicKey.toString()

    // First, check if key already exists on-chain (view call, no nonce needed)
    // This avoids nonce collisions when multiple workers start simultaneously
    const exists = await this.keyExistsOnChain(publicKeyStr)
    if (exists) {
      console.log(`Worker ${this.workerIndex}: Key already registered on parent account (checked on-chain)`)
      this.workerKeyRegistered = true
      return
    }

    // Key doesn't exist, need to add it. Retry with backoff for nonce collisions.
    const maxRetries = 5
    const baseDelayMs = 1000

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Use parent's original key to add the worker key as full access
        const parentAccount = new Account(this.parentAccountId, this.provider, this.parentSigner)

        // Add full access key for worker
        await parentAccount.addFullAccessKey(publicKey)
        console.log(`Worker ${this.workerIndex}: Added key ${publicKeyStr.slice(0, 20)}... to parent account`)
        this.workerKeyRegistered = true
        return
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error)

        // Key already exists = success (idempotent)
        // Error messages vary: "AddKeyAlreadyExists", "already exists", "already used for an existing access key"
        if (msg.includes("AddKeyAlreadyExists") || msg.includes("already exists") || msg.includes("already used")) {
          console.log(`Worker ${this.workerIndex}: Key already registered on parent account`)
          this.workerKeyRegistered = true
          return
        }

        // Nonce collision - another worker is adding their key simultaneously
        // Retry with backoff, then check if our key was added by someone else
        if (msg.includes("nonce") && attempt < maxRetries) {
          const delay = baseDelayMs * attempt + Math.random() * 500
          console.log(
            `Worker ${this.workerIndex}: Nonce collision, retrying in ${Math.round(delay)}ms (attempt ${attempt}/${maxRetries})`,
          )
          await this.sleep(delay)

          // Check again if key now exists (might have been added by another attempt)
          const nowExists = await this.keyExistsOnChain(publicKeyStr)
          if (nowExists) {
            console.log(`Worker ${this.workerIndex}: Key now exists on-chain after retry`)
            this.workerKeyRegistered = true
            return
          }
          continue
        }

        throw error
      }
    }

    throw new Error(`Worker ${this.workerIndex}: Failed to register key after ${maxRetries} attempts`)
  }

  /**
   * Creates a new test subaccount with 0.1 NEAR initial balance.
   * Returns the account credentials for use in tests.
   *
   * Uses the worker-specific key for signing, which has its own nonce sequence,
   * eliminating nonce collisions between parallel workers.
   *
   * Includes retry logic for edge cases (rate limits, network issues).
   */
  async createTestAccount(prefix = "e2e"): Promise<TestAccount> {
    // Ensure worker key is registered before creating accounts
    await this.ensureWorkerKeyExists()

    const timestamp = Date.now()
    const random = Math.random().toString(36).substring(2, 8)
    // Include worker index in name for easier debugging
    const subaccountId = `${prefix}-w${this.workerIndex}-${timestamp}-${random}.${this.parentAccountId}`

    const keyPair = KeyPair.fromRandom("ed25519")
    const publicKey = keyPair.getPublicKey().toString()
    const privateKey = keyPair.toString()

    // Small random jitter to avoid RPC rate limits when many workers start simultaneously
    const jitterMs = Math.random() * 500
    if (jitterMs > 100) {
      await this.sleep(jitterMs)
    }

    // Retry for edge cases (rate limits, network issues)
    // With worker-specific keys, nonce collisions should not happen
    const maxRetries = 5
    const baseDelayMs = 500

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Use worker-specific signer (independent nonce sequence)
        const parentAccount = new Account(this.parentAccountId, this.provider, this.workerSigner)

        // Create subaccount with 0.1 NEAR (100000000000000000000000 yoctoNEAR)
        await parentAccount.createAccount(subaccountId, keyPair.getPublicKey(), BigInt("100000000000000000000000"))

        const account: TestAccount = { accountId: subaccountId, publicKey, privateKey }
        this.createdAccounts.push(account)

        return account
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)

        // Check if account already exists (previous attempt succeeded but timed out)
        const isAccountExistsError =
          errorMessage.includes("AccountAlreadyExists") || errorMessage.includes("already exists")

        if (isAccountExistsError) {
          // Account was created in a previous attempt that timed out
          console.log(`Account ${subaccountId} already exists (previous attempt succeeded)`)
          const account: TestAccount = { accountId: subaccountId, publicKey, privateKey }
          this.createdAccounts.push(account)
          return account
        }

        // Check if this is a retryable error
        const isRateLimitError = errorMessage.includes("429") || errorMessage.includes("DEPRECATED")
        const isNetworkError = errorMessage.includes("ECONNRESET") || errorMessage.includes("timeout")
        const isRetryable = isRateLimitError || isNetworkError

        if (!isRetryable || attempt === maxRetries) {
          console.error(
            `Worker ${this.workerIndex}: Failed to create account ${subaccountId} after ${attempt} attempts:`,
            errorMessage,
          )
          throw error
        }

        // Exponential backoff with jitter
        const delay = baseDelayMs * Math.pow(2, attempt - 1) + Math.random() * 500
        console.warn(
          `Worker ${this.workerIndex}: Retrying account creation (attempt ${attempt}/${maxRetries}) in ${Math.round(delay)}ms...`,
        )
        await this.sleep(delay)
      }
    }

    // This should never be reached due to the throw in the loop
    throw new Error(`Failed to create account ${subaccountId} after ${maxRetries} attempts`)
  }

  /**
   * Helper to sleep for a given number of milliseconds.
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  /**
   * Deletes a test subaccount and returns remaining balance to parent.
   */
  async deleteTestAccount(accountId: string): Promise<void> {
    const account = this.createdAccounts.find((a) => a.accountId === accountId)
    if (!account) {
      console.warn(`Account ${accountId} not found in created accounts list`)
      return
    }

    try {
      const keyPair = KeyPair.fromString(account.privateKey as KeyPairString)
      const signer = new KeyPairSigner(keyPair)
      const subaccount = new Account(accountId, this.provider, signer)

      // Delete account and send remaining balance back to parent
      await subaccount.signAndSendTransaction({
        receiverId: accountId,
        actions: [actionCreators.deleteAccount(this.parentAccountId)],
      })

      this.createdAccounts = this.createdAccounts.filter((a) => a.accountId !== accountId)
    } catch (error) {
      console.error(`Failed to delete account ${accountId}:`, error)
      throw error
    }
  }

  /**
   * Cleans up all created test accounts.
   * Call this in afterAll or test teardown.
   */
  async cleanupAll(): Promise<void> {
    const accountsToDelete = [...this.createdAccounts]
    for (const account of accountsToDelete) {
      try {
        await this.deleteTestAccount(account.accountId)
        console.log(`Deleted test account: ${account.accountId}`)
      } catch (e) {
        console.warn(`Failed to delete ${account.accountId}:`, e)
      }
    }
  }

  /**
   * Gets the list of created accounts (for debugging/verification).
   */
  getCreatedAccounts(): TestAccount[] {
    return [...this.createdAccounts]
  }
}
