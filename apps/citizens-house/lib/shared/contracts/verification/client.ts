/**
 * NEAR smart contract database implementation
 *
 * Note on type assertions: The @near-js packages have inconsistent type definitions
 * across versions. We use targeted `as unknown as X` casts in a few places where
 * the runtime types are correct but TypeScript definitions don't match.
 * See: https://github.com/near/near-api-js/issues/1179
 */
import "server-only"

import { Account } from "@near-js/accounts"
import type { Provider } from "@near-js/providers"
import type { Signer } from "@near-js/signers"
import { KeyPair } from "@near-js/crypto"
import { KeyPairSigner } from "@near-js/signers"
import {
  contractVerificationSchema,
  contractVerificationSummarySchema,
  type ContractVerification,
  type ContractVerificationSummary,
  type ContractSelfProofInput,
  type ContractSignatureInput,
  type IVerificationDatabase,
  type VerificationDataWithSignature,
  type Verification,
  type VerificationSummary,
} from "./types"
import { NEAR_CONFIG } from "../../config"
import { createRpcProvider } from "../../rpc"
import { backendKeyPool, setBackendKeyPoolRedis } from "./backend-key-pool"

// Re-export for app initialization
export { setBackendKeyPoolRedis }

export type { IVerificationDatabase, VerificationDataWithSignature, Verification, VerificationSummary }

export class NearContractDatabase implements IVerificationDatabase {
  private account: Account | null = null
  private provider: Provider | null = null
  private contractId: string
  private initialized: Promise<void>

  constructor(
    private backendAccountId: string,
    private backendPrivateKey: string,
    contractId: string,
  ) {
    this.contractId = contractId
    this.initialized = this.init()
  }

  private async init() {
    try {
      // KeyPair.fromString expects a string but the type definition is overly strict
      // Runtime accepts ed25519:... format strings which we use
      const keyPair = KeyPair.fromString(this.backendPrivateKey as `ed25519:${string}`)
      const signer = new KeyPairSigner(keyPair)

      // Create RPC provider (FastNEAR)
      this.provider = createRpcProvider()

      // Account constructor types don't match the actual implementation
      // The provider and signer interfaces are compatible at runtime
      this.account = new Account(this.backendAccountId, this.provider, signer as unknown as Signer)

      console.log(`[NearContractDB] Initialized with account: ${this.backendAccountId}`)
      console.log(`[NearContractDB] Contract ID: ${this.contractId}`)
      console.log(`[NearContractDB] Network: ${NEAR_CONFIG.networkId}`)
    } catch (error) {
      console.error("[NearContractDB] Initialization error:", error)
      throw error
    }
  }

  private async ensureInitialized() {
    await this.initialized
    if (!this.account) {
      throw new Error("NEAR account not initialized")
    }
  }

  /**
   * Check if error is an RPC timeout (500 Internal Server Error)
   * RPC calls can timeout while the transaction still succeeds on-chain
   */

  private isRpcTimeoutError(error: unknown): boolean {
    if (error instanceof Error) {
      const msg = error.message.toLowerCase()
      return (
        msg.includes("internal server error") ||
        msg.includes("timed out") ||
        msg.includes("timeout") ||
        msg.includes("500")
      )
    }
    return false
  }

  /**
   * Simple delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  /**
   * Wrap a promise with a timeout to prevent infinite hangs
   */
  private withTimeout<T>(promise: Promise<T>, ms: number, operation: string): Promise<T> {
    return Promise.race([
      promise,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`[NearContractDB] ${operation} timed out after ${ms}ms`)), ms),
      ),
    ])
  }

  /**
   * Check if we're on mainnet (for network-aware timing)
   */
  private isMainnet(): boolean {
    return this.contractId.endsWith(".near")
  }

  /**
   * Poll for verification confirmation with exponential backoff
   * Uses network-aware timing (mainnet needs longer delays)
   */
  private async pollForVerification(nearAccountId: string): Promise<boolean> {
    // Network-aware polling configuration
    // Mainnet blocks take longer to finalize (~2-3s), testnet is faster (~1s)
    const isMainnet = this.isMainnet()
    const maxAttempts = isMainnet ? 15 : 10
    const initialDelayMs = isMainnet ? 2000 : 500
    const maxDelayMs = isMainnet ? 8000 : 5000
    const rpcCallTimeout = 10000 // 10 seconds per RPC call

    let delayMs = initialDelayMs

    console.log(
      `[NearContractDB] Starting poll (${isMainnet ? "mainnet" : "testnet"}): ${maxAttempts} attempts, ${initialDelayMs}ms initial delay`,
    )

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        // Add timeout to individual verification check to prevent hanging
        const verified = await this.withTimeout(
          this.isVerifiedInternal(nearAccountId),
          rpcCallTimeout,
          `poll attempt ${attempt}`,
        )
        if (verified) {
          console.log(`[NearContractDB] Verification confirmed on attempt ${attempt}`)
          return true
        }
        console.log(`[NearContractDB] Poll attempt ${attempt}: not yet verified`)
      } catch (error) {
        // Log but continue polling - RPC might be temporarily unavailable
        const errMsg = error instanceof Error ? error.message : String(error)
        console.warn(`[NearContractDB] Poll attempt ${attempt} failed: ${errMsg}`)
      }

      if (attempt < maxAttempts) {
        await this.delay(delayMs)
        // Exponential backoff with network-aware cap
        delayMs = Math.min(delayMs * 1.5, maxDelayMs)
      }
    }

    return false
  }

  /**
   * Internal isVerified without timeout (used by polling which handles its own timeouts)
   */
  private async isVerifiedInternal(nearAccountId: string): Promise<boolean> {
    const result = await this.provider!.callFunction<boolean>(this.contractId, "is_verified", {
      account_id: nearAccountId,
    })
    return result ?? false
  }

  async isVerified(nearAccountId: string): Promise<boolean> {
    await this.ensureInitialized()

    try {
      // Add timeout to prevent hanging on slow RPC
      return await this.withTimeout(this.isVerifiedInternal(nearAccountId), 10000, "isVerified")
    } catch (error) {
      console.error("[NearContractDB] Error checking account:", error)
      throw error
    }
  }

  async storeVerification(data: VerificationDataWithSignature): Promise<void> {
    await this.ensureInitialized()

    // Overall timeout for the entire operation to prevent infinite hangs
    // Mainnet needs longer due to slower block finality
    const overallTimeoutMs = this.isMainnet() ? 90000 : 60000 // 90s mainnet, 60s testnet

    return this.withTimeout(this.storeVerificationImpl(data), overallTimeoutMs, "storeVerification")
  }

  /**
   * Internal implementation of storeVerification (wrapped with timeout by public method)
   *
   * Uses the backend key pool for parallel transaction support.
   * Each request gets the next available key via atomic Redis INCR,
   * enabling concurrent transactions without nonce collisions.
   */
  private async storeVerificationImpl(data: VerificationDataWithSignature): Promise<void> {
    try {
      // Extract NEAR signature data and Self proof from verification data
      const { signatureData, selfProofData, userContextData, ...verificationData } = data

      // Convert signature data to contract format
      // Use .map(Number) to ensure arrays contain actual numbers, not strings
      // (string arrays can occur due to JSON serialization edge cases)
      const nearSigData: ContractSignatureInput = {
        account_id: signatureData.accountId,
        signature: Array.from(Buffer.from(signatureData.signature, "base64")).map(Number),
        public_key: signatureData.publicKey,
        challenge: signatureData.challenge,
        nonce: signatureData.nonce.map(Number),
        recipient: signatureData.recipient,
      }

      // Convert Self proof data to contract format
      const selfProof: ContractSelfProofInput = {
        proof: selfProofData.proof,
        public_signals: selfProofData.publicSignals,
      }

      // Get account with next pooled key (atomic via Redis)
      // Each key has its own nonce sequence, enabling parallel transactions
      const { account: pooledAccount, keyIndex } = await backendKeyPool.createAccountWithNextKey()
      console.log(`[NearContractDB] Calling store_verification using key ${keyIndex}...`)

      // Send transaction and wait for execution to surface contract failures.
      const executionTimeoutMs = this.isMainnet() ? 45000 : 30000
      const result = await this.withTimeout(
        pooledAccount.callFunctionRaw({
          contractId: this.contractId,
          methodName: "store_verification",
          args: {
            nullifier: verificationData.nullifier,
            near_account_id: verificationData.nearAccountId,
            attestation_id: verificationData.attestationId,
            signature_data: nearSigData,
            self_proof: selfProof,
            user_context_data: userContextData,
          },
          gas: "30000000000000", // 30 TGas
          deposit: "1", // 1 yoctoNEAR deposit (required by assert_one_yocto)
          waitUntil: "EXECUTED_OPTIMISTIC",
        }),
        executionTimeoutMs,
        "transaction execution",
      )

      const txHash = result?.transaction?.hash ?? result?.transaction_outcome?.id ?? "unknown"
      console.log("[NearContractDB] Transaction executed:", { txHash, nearAccountId: data.nearAccountId })

      return
    } catch (error) {
      console.error("[NearContractDB] Error storing verification:", error)

      // Check if this is a timeout error where the transaction might have succeeded
      // RPC can return 500 errors while the transaction actually completes on-chain
      if (this.isRpcTimeoutError(error)) {
        console.log("[NearContractDB] RPC timeout detected, checking if verification succeeded...")

        // Poll to check if verification actually succeeded despite the error
        const verified = await this.pollForVerification(data.nearAccountId)
        if (verified) {
          console.log("[NearContractDB] Verification confirmed on-chain despite RPC timeout")
          return // Success - don't throw
        }

        console.log("[NearContractDB] Verification not found after timeout, throwing original error")
      }

      // Parse contract panic message if available
      if (error instanceof Error && error.message.includes("Smart contract panicked")) {
        const panicMatch = error.message.match(/Smart contract panicked: (.+)/)
        if (panicMatch) {
          throw new Error(panicMatch[1])
        }
      }

      throw error
    }
  }

  async getVerification(nearAccountId: string): Promise<VerificationSummary | null> {
    await this.ensureInitialized()

    try {
      const result = await this.provider!.callFunction<ContractVerificationSummary>(
        this.contractId,
        "get_verification",
        {
          account_id: nearAccountId,
        },
      )

      if (!result) {
        return null
      }

      // Validate and transform contract response using Zod schema
      // Automatically converts snake_case to camelCase and nanoseconds to milliseconds
      return contractVerificationSummarySchema.parse(result)
    } catch (error) {
      console.error("[NearContractDB] Error getting verification:", error)
      // Return null for not found instead of throwing
      return null
    }
  }

  async getFullVerification(nearAccountId: string): Promise<Verification | null> {
    await this.ensureInitialized()

    try {
      const result = await this.provider!.callFunction<ContractVerification>(this.contractId, "get_full_verification", {
        account_id: nearAccountId,
      })

      if (!result) {
        return null
      }

      // Validate and transform contract response using Zod schema
      // Automatically converts snake_case to camelCase and nanoseconds to milliseconds
      return contractVerificationSchema.parse(result)
    } catch (error) {
      console.error("[NearContractDB] Error getting full verification:", error)
      // Return null for not found instead of throwing
      return null
    }
  }

  // Get paginated verifications
  async listVerifications(
    fromIndex: number = 0,
    limit: number = 50,
  ): Promise<{ accounts: Verification[]; total: number }> {
    await this.ensureInitialized()

    try {
      const [total, accounts] = await Promise.all([
        this.provider!.callFunction<number>(this.contractId, "get_verified_count", {}),
        this.provider!.callFunction<ContractVerification[]>(this.contractId, "list_verifications", {
          from_index: fromIndex,
          limit: Math.min(limit, 100),
        }),
      ])

      // Validate and transform each contract response using Zod schema
      const verifications = (accounts ?? []).map((item) => contractVerificationSchema.parse(item))

      return { accounts: verifications, total: total ?? 0 }
    } catch (error) {
      console.error("[NearContractDB] Error getting paginated verifications:", error)
      return { accounts: [], total: 0 }
    }
  }

  // Get paginated verifications ordered by newest first
  async listVerificationsNewestFirst(
    page: number = 0,
    pageSize: number = 50,
  ): Promise<{ accounts: Verification[]; total: number }> {
    await this.ensureInitialized()

    try {
      const total = (await this.provider!.callFunction<number>(this.contractId, "get_verified_count", {})) ?? 0

      if (total === 0) {
        return { accounts: [], total }
      }

      const safePage = Math.max(0, page)
      const remaining = Math.max(total - safePage * pageSize, 0)

      if (remaining === 0) {
        return { accounts: [], total }
      }

      const limit = Math.min(pageSize, remaining, 100)
      const fromIndex = Math.max(total - (safePage + 1) * pageSize, 0)

      const accounts = await this.provider!.callFunction<ContractVerification[]>(
        this.contractId,
        "list_verifications",
        {
          from_index: fromIndex,
          limit,
        },
      )

      const verifications = (accounts ?? []).map((item) => contractVerificationSchema.parse(item))

      return { accounts: verifications.reverse(), total }
    } catch (error) {
      console.error("[NearContractDB] Error getting paginated verifications:", error)
      return { accounts: [], total: 0 }
    }
  }
}

export class NearContractReadOnlyDatabase implements IVerificationDatabase {
  private provider: Provider
  private contractId: string

  constructor(contractId: string) {
    this.contractId = contractId
    this.provider = createRpcProvider()
  }

  async isVerified(nearAccountId: string): Promise<boolean> {
    try {
      const result = await this.provider.callFunction<boolean>(this.contractId, "is_verified", {
        account_id: nearAccountId,
      })
      return result ?? false
    } catch (error) {
      console.error("[NearContractDB] Error checking account:", error)
      throw error
    }
  }

  async storeVerification(_data: VerificationDataWithSignature): Promise<void> {
    throw new Error(
      "verificationDb.storeVerification() is not available without NEAR_ACCOUNT_ID and NEAR_PRIVATE_KEY configured.",
    )
  }

  async getVerification(nearAccountId: string): Promise<VerificationSummary | null> {
    try {
      const result = await this.provider.callFunction<ContractVerificationSummary>(
        this.contractId,
        "get_verification",
        {
          account_id: nearAccountId,
        },
      )

      if (!result) {
        return null
      }

      return contractVerificationSummarySchema.parse(result)
    } catch (error) {
      console.error("[NearContractDB] Error getting verification:", error)
      return null
    }
  }

  async getFullVerification(nearAccountId: string): Promise<Verification | null> {
    try {
      const result = await this.provider.callFunction<ContractVerification>(this.contractId, "get_full_verification", {
        account_id: nearAccountId,
      })

      if (!result) {
        return null
      }

      return contractVerificationSchema.parse(result)
    } catch (error) {
      console.error("[NearContractDB] Error getting full verification:", error)
      return null
    }
  }

  async listVerifications(
    fromIndex: number = 0,
    limit: number = 50,
  ): Promise<{ accounts: Verification[]; total: number }> {
    try {
      const [total, accounts] = await Promise.all([
        this.provider.callFunction<number>(this.contractId, "get_verified_count", {}),
        this.provider.callFunction<ContractVerification[]>(this.contractId, "list_verifications", {
          from_index: fromIndex,
          limit: Math.min(limit, 100),
        }),
      ])

      const verifications = (accounts ?? []).map((item) => contractVerificationSchema.parse(item))

      return { accounts: verifications, total: total ?? 0 }
    } catch (error) {
      console.error("[NearContractDB] Error getting paginated verifications:", error)
      return { accounts: [], total: 0 }
    }
  }

  async listVerificationsNewestFirst(
    page: number = 0,
    pageSize: number = 50,
  ): Promise<{ accounts: Verification[]; total: number }> {
    try {
      const total = (await this.provider.callFunction<number>(this.contractId, "get_verified_count", {})) ?? 0

      if (total === 0) {
        return { accounts: [], total }
      }

      const safePage = Math.max(0, page)
      const remaining = Math.max(total - safePage * pageSize, 0)

      if (remaining === 0) {
        return { accounts: [], total }
      }

      const limit = Math.min(pageSize, remaining, 100)
      const fromIndex = Math.max(total - (safePage + 1) * pageSize, 0)

      const accounts = await this.provider.callFunction<ContractVerification[]>(this.contractId, "list_verifications", {
        from_index: fromIndex,
        limit,
      })

      const verifications = (accounts ?? []).map((item) => contractVerificationSchema.parse(item))

      return { accounts: verifications.reverse(), total }
    } catch (error) {
      console.error("[NearContractDB] Error getting paginated verifications:", error)
      return { accounts: [], total: 0 }
    }
  }
}

// ============================================================================
// Singleton Database Instance (Lazy Initialization)
// ============================================================================

let dbInstance: IVerificationDatabase | null = null

function createVerificationContract(): IVerificationDatabase {
  const { verificationContractId, backendAccountId, backendPrivateKey } = NEAR_CONFIG

  if (!verificationContractId) {
    throw new Error(
      "Missing required NEAR configuration. Please set:\n" +
        "- NEXT_PUBLIC_NEAR_VERIFICATION_CONTRACT (contract account address)\n" +
        "See DEVELOPER.md for setup instructions.",
    )
  }

  console.log("[VerificationContract] Using NEAR smart contract")
  console.log(`[VerificationContract] Contract: ${verificationContractId}`)
  console.log(`[VerificationContract] Network: ${NEAR_CONFIG.networkId}`)

  if (backendAccountId && backendPrivateKey) {
    console.log("[VerificationContract] Mode: read-write")
    return new NearContractDatabase(backendAccountId, backendPrivateKey, verificationContractId)
  }

  console.log("[VerificationContract] Mode: read-only")
  return new NearContractReadOnlyDatabase(verificationContractId)
}

// Lazy singleton - only initialize when first accessed (not during build)
export const verificationDb: IVerificationDatabase = new Proxy({} as IVerificationDatabase, {
  get(target, prop) {
    if (!dbInstance) {
      dbInstance = createVerificationContract()
    }
    return dbInstance[prop as keyof IVerificationDatabase]
  },
})
