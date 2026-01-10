/**
 * Playwright Global Setup
 *
 * Registers all worker access keys on the parent NEAR account in a SINGLE transaction.
 * This avoids nonce collisions during parallel test execution.
 *
 * Keys are deterministic and reusable - once registered, they persist forever.
 */
import { Account } from "@near-js/accounts"
import { KeyPair } from "@near-js/crypto"
import type { KeyPairString } from "@near-js/crypto"
import { KeyPairSigner } from "@near-js/signers"
import { JsonRpcProvider } from "@near-js/providers"
import { actionCreators } from "@near-js/transactions"
import type { FullConfig } from "@playwright/test"
import { deriveWorkerKey } from "./helpers/deterministic-keys"

// FastNEAR for reliable transaction broadcasting
function getRpcUrl(): string {
  const networkId = process.env.NEXT_PUBLIC_NEAR_NETWORK || "testnet"
  return networkId === "mainnet" ? "https://free.rpc.fastnear.com" : "https://test.rpc.fastnear.com"
}

async function keyExistsOnChain(rpcUrl: string, accountId: string, publicKeyStr: string): Promise<boolean> {
  try {
    const response = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
    return !data.error && data.result?.permission
  } catch {
    return false
  }
}

async function globalSetup(config: FullConfig) {
  const parentAccountId = process.env.NEAR_ACCOUNT_ID
  const parentPrivateKey = process.env.NEAR_PRIVATE_KEY
  // Use Playwright's resolved worker count (respects E2E_WORKERS, CI defaults, and auto-detection)
  // Fall back to 1 only if config.workers is somehow undefined
  const workerCount = config.workers ?? 1

  if (!parentAccountId || !parentPrivateKey) {
    console.log("[Global Setup] NEAR_ACCOUNT_ID or NEAR_PRIVATE_KEY not set, skipping key registration")
    return
  }

  const rpcUrl = getRpcUrl()
  console.log(`[Global Setup] Checking worker keys for ${workerCount} workers on ${parentAccountId}`)

  // Derive all worker keys and check which ones need to be registered
  // PublicKey type: the return type of calling getPublicKey() on a derived worker key
  type PublicKey = ReturnType<ReturnType<typeof deriveWorkerKey>["getPublicKey"]>
  const keysToRegister: { workerIndex: number; publicKey: PublicKey }[] = []

  for (let i = 0; i < workerCount; i++) {
    const workerKey = deriveWorkerKey(parentPrivateKey, i)
    const publicKey = workerKey.getPublicKey()
    const publicKeyStr = publicKey.toString()

    const exists = await keyExistsOnChain(rpcUrl, parentAccountId, publicKeyStr)
    if (!exists) {
      keysToRegister.push({ workerIndex: i, publicKey })
      console.log(`[Global Setup] Worker ${i}: Key needs registration (${publicKeyStr.slice(0, 20)}...)`)
    } else {
      console.log(`[Global Setup] Worker ${i}: Key already registered`)
    }
  }

  if (keysToRegister.length === 0) {
    console.log("[Global Setup] All worker keys already registered, nothing to do")
    return
  }

  // Register all missing keys in a SINGLE batch transaction
  console.log(`[Global Setup] Registering ${keysToRegister.length} worker keys in batch transaction...`)

  const provider = new JsonRpcProvider({ url: rpcUrl })
  const parentKeyPair = KeyPair.fromString(parentPrivateKey as KeyPairString)
  const parentSigner = new KeyPairSigner(parentKeyPair)
  const parentAccount = new Account(parentAccountId, provider, parentSigner)

  // Build batch of addKey actions
  const actions = keysToRegister.map(({ publicKey }) =>
    actionCreators.addKey(publicKey, actionCreators.fullAccessKey()),
  )

  try {
    await parentAccount.signAndSendTransaction({
      receiverId: parentAccountId,
      actions,
    })
    console.log(`[Global Setup] Successfully registered ${keysToRegister.length} worker keys`)
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)

    // If some keys already exist (race condition), that's fine
    if (msg.includes("AddKeyAlreadyExists") || msg.includes("already exists") || msg.includes("already used")) {
      console.log("[Global Setup] Some keys already existed (concurrent registration), continuing...")
      return
    }

    console.error("[Global Setup] Failed to register worker keys:", msg)
    throw error
  }
}

export default globalSetup
