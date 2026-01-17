/**
 * Playwright Global Setup
 *
 * Registers all worker access keys on the parent NEAR account in batch transactions.
 * This avoids nonce collisions during parallel test execution.
 *
 * Keys are deterministic and reusable - once registered, they persist forever.
 */
import { Account } from "@near-js/accounts"
import { KeyPair } from "@near-js/crypto"
import type { KeyPairString } from "@near-js/crypto"
import { KeyPairSigner } from "@near-js/signers"
import { JsonRpcProvider } from "@near-js/providers"
import type { Provider } from "@near-js/providers"
import { actionCreators } from "@near-js/transactions"
import type { FullConfig } from "@playwright/test"
import { deriveWorkerKey } from "./helpers/deterministic-keys"
import type { NearAccountId } from "@near-citizens/shared"

// FastNEAR RPC configuration
function getFastNearUrl(): string {
  const networkId = process.env.NEXT_PUBLIC_NEAR_NETWORK || "testnet"
  return networkId === "mainnet" ? "https://rpc.mainnet.fastnear.com" : "https://rpc.testnet.fastnear.com"
}

function getFastNearHeaders(): Record<string, string> {
  const headers: Record<string, string> = {}
  const apiKey = process.env.FASTNEAR_API_KEY
  if (apiKey) {
    headers["X-API-Key"] = apiKey
  }
  return headers
}

function createRpcProvider(rpcUrl: string): Provider {
  return new JsonRpcProvider({ url: rpcUrl, headers: getFastNearHeaders() })
}

async function keyExistsOnChain(rpcUrl: string, accountId: NearAccountId, publicKeyStr: string): Promise<boolean> {
  try {
    const headers = {
      "Content-Type": "application/json",
      ...getFastNearHeaders(),
    }
    const response = await fetch(rpcUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "check-key",
        method: "query",
        params: {
          request_type: "view_access_key",
          finality: "final",
          account_id: accountId,
          public_key: publicKeyStr,
        },
      }),
    })
    const data = await response.json()
    if (!data.error && data.result?.permission) {
      return true
    }
  } catch {
    // Ignore transient RPC errors
  }

  return false
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function globalSetup(config: FullConfig) {
  const parentAccountId = process.env.NEAR_ACCOUNT_ID
  const parentPrivateKey = process.env.NEAR_PRIVATE_KEY
  // Use Playwright's resolved worker count (respects E2E_WORKERS, CI defaults, and auto-detection)
  // Fall back to 1 only if config.workers is somehow undefined
  const workerCount = config.workers ?? 1

  if (!parentAccountId || !parentPrivateKey) {
    return
  }

  const accountId = parentAccountId
  const privateKey = parentPrivateKey
  const rpcUrl = getFastNearUrl()

  // Derive all worker keys and check which ones need to be registered
  // PublicKey type: the return type of calling getPublicKey() on a derived worker key
  type PublicKey = ReturnType<ReturnType<typeof deriveWorkerKey>["getPublicKey"]>
  const keysToRegister: { workerIndex: number; publicKey: PublicKey }[] = []

  for (let i = 0; i < workerCount; i++) {
    const workerKey = deriveWorkerKey(privateKey, i)
    const publicKey = workerKey.getPublicKey()
    const publicKeyStr = publicKey.toString()

    const exists = await keyExistsOnChain(rpcUrl, accountId, publicKeyStr)

    if (!exists) {
      keysToRegister.push({ workerIndex: i, publicKey })
    }
  }

  if (keysToRegister.length === 0) {
    return
  }

  const provider = createRpcProvider(rpcUrl)
  const parentKeyPair = KeyPair.fromString(privateKey as KeyPairString)
  const parentSigner = new KeyPairSigner(parentKeyPair)

  const configuredBatchSize = Number(process.env.E2E_KEY_BATCH_SIZE || "25")
  const batchSize = Number.isFinite(configuredBatchSize) && configuredBatchSize > 0 ? configuredBatchSize : 25

  async function registerBatch(batch: { workerIndex: number; publicKey: PublicKey }[]) {
    let pending = batch
    const maxRetries = 5
    const baseDelayMs = 1000

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const actions = pending.map(({ publicKey }) => actionCreators.addKey(publicKey, actionCreators.fullAccessKey()))

      try {
        const parentAccount = new Account(accountId, provider, parentSigner)
        await parentAccount.signAndSendTransaction({
          receiverId: accountId,
          actions,
        })
        return
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error)
        const isAlreadyExists =
          msg.includes("AddKeyAlreadyExists") || msg.includes("already exists") || msg.includes("already used")

        if (isAlreadyExists) {
          const missing: { workerIndex: number; publicKey: PublicKey }[] = []
          for (const key of pending) {
            const publicKeyStr = key.publicKey.toString()
            const exists = await keyExistsOnChain(rpcUrl, accountId, publicKeyStr)

            if (!exists) {
              missing.push(key)
            }
          }

          if (missing.length === 0) {
            return
          }

          pending = missing
          const delay = baseDelayMs + Math.random() * 500
          await sleep(delay)
          continue
        }

        const isRetryable =
          msg.includes("nonce") ||
          msg.includes("InvalidNonce") ||
          msg.includes("timeout") ||
          msg.includes("ECONNRESET") ||
          msg.includes("500") ||
          msg.includes("Server error")

        if (!isRetryable || attempt === maxRetries) {
          throw error
        }

        const delay = baseDelayMs * attempt + Math.random() * 500
        await sleep(delay)
      }
    }
  }

  for (let start = 0; start < keysToRegister.length; start += batchSize) {
    const batch = keysToRegister.slice(start, start + batchSize)
    await registerBatch(batch)
  }
}

export default globalSetup
