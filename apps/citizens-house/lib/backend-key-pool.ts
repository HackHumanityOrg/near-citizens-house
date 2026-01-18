/**
 * Backend Wallet Key Pool for Concurrent Transaction Support
 *
 * This module manages a pool of access keys for the backend wallet to enable
 * parallel transaction submission without nonce collisions.
 *
 * Key Design:
 * - 10 deterministically-derived keys from NEAR_PRIVATE_KEY
 * - Redis INCR for atomic round-robin key selection across Lambda instances
 * - Same key derivation algorithm as E2E worker keys (deterministic-keys.ts)
 *
 * Security:
 * - No private keys stored in Redis - only a counter (0, 1, 2...)
 * - Keys derived in-memory from NEAR_PRIVATE_KEY + index
 * - Private keys never leave the Lambda function's memory
 */
import "server-only"

import { sha256 } from "@noble/hashes/sha2.js"
import { ed25519 } from "@noble/curves/ed25519.js"
import { baseEncode } from "@near-js/utils"
import { KeyPairEd25519 } from "@near-js/crypto"
import { KeyPairSigner } from "@near-js/signers"
import { Account } from "@near-js/accounts"
import type { Signer } from "@near-js/signers"
import { NEAR_SERVER_CONFIG } from "./config.server"
import { createRpcProvider } from "./providers/rpc-provider"
import type { VerifyContext } from "./logger/request-context"

const POOL_SIZE = 10 // Support 10 concurrent transactions
const REDIS_KEY = "backend-key-pool:index"

// Type for Redis client (injected from app)
type RedisClient = {
  incr: (key: string) => Promise<number>
}

// Singleton reference to injected Redis client
let redisClient: RedisClient | null = null

/**
 * Set the Redis client for the key pool.
 * Must be called before using the key pool (e.g., in API route initialization).
 */
export function setBackendKeyPoolRedis(client: RedisClient): void {
  redisClient = client
}

/**
 * Pool of access keys for the backend wallet.
 * Uses Redis INCR for atomic round-robin across serverless instances.
 */
class BackendKeyPool {
  private keys: KeyPairEd25519[] = []
  private contractId: string

  constructor() {
    this.contractId = NEAR_SERVER_CONFIG.verificationContractId
  }

  /**
   * Derive deterministic keys from the master private key.
   * Uses same pattern as E2E worker keys (deterministic-keys.ts).
   */
  private deriveKeys(): void {
    if (this.keys.length > 0) return

    const masterKey = NEAR_SERVER_CONFIG.backendPrivateKey
    if (!masterKey) throw new Error("NEAR_PRIVATE_KEY not configured")

    for (let i = 0; i < POOL_SIZE; i++) {
      const derivedKey = this.deriveKey(masterKey, i)
      this.keys.push(derivedKey)
    }
  }

  /**
   * Derive a key from master key + index (deterministic).
   * Same algorithm as deterministic-keys.ts.
   */
  private deriveKey(masterKey: string, index: number): KeyPairEd25519 {
    // Deterministic: same seed + index = same key every time
    const input = `${masterKey}:backend-key:${index}`
    const secretKey = sha256(new TextEncoder().encode(input)) // 32 bytes

    // Replicate KeyPairEd25519.fromRandom() logic with deterministic seed
    // See: https://github.com/near/near-api-js/blob/master/packages/crypto/src/key_pair_ed25519.ts
    const publicKey = ed25519.getPublicKey(new Uint8Array(secretKey))
    const extendedSecretKey = new Uint8Array([...secretKey, ...publicKey])

    return new KeyPairEd25519(baseEncode(extendedSecretKey))
  }

  /**
   * Get next key index atomically via Redis INCR.
   * Round-robin across POOL_SIZE keys.
   */
  private async getNextKeyIndex(): Promise<number> {
    if (!redisClient) {
      throw new Error("[BackendKeyPool] Redis client not initialized. Call setBackendKeyPoolRedis() first.")
    }

    const counter = await redisClient.incr(REDIS_KEY)
    return (counter - 1) % POOL_SIZE // 0-indexed
  }

  /**
   * Create an Account instance with the next available pooled key.
   * Returns the account and key index for logging.
   * Optionally accepts a RequestContext to log the key index.
   */
  async createAccountWithNextKey(ctx?: VerifyContext): Promise<{ account: Account; keyIndex: number }> {
    this.deriveKeys()

    ctx?.startTimer("keyPoolSelection")
    const keyIndex = await this.getNextKeyIndex()
    ctx?.endTimer("keyPoolSelection")
    ctx?.setNested("keyPool.index", keyIndex)

    const keyPair = this.keys[keyIndex]
    const signer = new KeyPairSigner(keyPair)
    const provider = createRpcProvider()

    // Account constructor types don't match the actual implementation
    // The provider and signer interfaces are compatible at runtime
    const account = new Account(NEAR_SERVER_CONFIG.backendAccountId, provider, signer as unknown as Signer)

    return { account, keyIndex }
  }

  /**
   * Get a specific key by index (for key registration script).
   */
  getKeyByIndex(index: number): KeyPairEd25519 {
    this.deriveKeys()
    if (index < 0 || index >= POOL_SIZE) {
      throw new Error(`[BackendKeyPool] Invalid key index: ${index}. Must be 0-${POOL_SIZE - 1}`)
    }
    return this.keys[index]
  }

  /**
   * Get all derived public keys (for registration script).
   */
  getAllPublicKeys(): string[] {
    this.deriveKeys()
    return this.keys.map((k) => k.getPublicKey().toString())
  }

  /**
   * Get the pool size (number of keys).
   */
  getPoolSize(): number {
    return POOL_SIZE
  }
}

// Singleton instance
export const backendKeyPool = new BackendKeyPool()
