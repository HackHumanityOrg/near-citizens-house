/**
 * NEAR smart contract database implementation
 *
 * Note on type assertions: The @near-js packages have inconsistent type definitions
 * across versions. We use targeted `as unknown as X` casts in a few places where
 * the runtime types are correct but TypeScript definitions don't match.
 * See: https://github.com/near/near-api-js/issues/1179
 */
import { Account } from "@near-js/accounts"
import type { Provider } from "@near-js/providers"
import type { Signer } from "@near-js/signers"
import { KeyPair } from "@near-js/crypto"
import { JsonRpcProvider, FailoverRpcProvider } from "@near-js/providers"
import { KeyPairSigner } from "@near-js/signers"
import { actionCreators } from "@near-js/transactions"
import {
  contractVerifiedAccountSchema,
  type ContractVerifiedAccount,
  type ContractSelfProofInput,
  type ContractSignatureInput,
  type IVerificationDatabase,
  type VerificationDataWithSignature,
  type VerifiedAccount,
} from "./types"
import { NEAR_CONFIG } from "../../config"

export type { IVerificationDatabase, VerificationDataWithSignature, VerifiedAccount }

// Fallback RPC URLs for read operations
const FALLBACK_RPC_URLS = {
  mainnet: ["https://free.rpc.fastnear.com", "https://near.lava.build:443", "https://rpc.mainnet.near.org"],
  testnet: ["https://rpc.testnet.fastnear.com", "https://rpc.testnet.near.org"],
}

// Retry options for JsonRpcProvider
const RPC_RETRY_OPTIONS = {
  retries: 3, // Number of retries before giving up
  wait: 500, // Wait 500ms between retries
  backoff: 2, // Exponential backoff multiplier
}

export class NearContractDatabase implements IVerificationDatabase {
  private account: Account | null = null
  private provider: FailoverRpcProvider | null = null
  private contractId: string
  private initialized: Promise<void>

  constructor(
    private backendAccountId: string,
    private backendPrivateKey: string,
    contractId: string,
    private networkId: string,
    private rpcUrl: string,
  ) {
    this.contractId = contractId
    this.initialized = this.init()
  }

  // Create a FailoverRpcProvider with multiple RPC endpoints
  private createFailoverProvider(): FailoverRpcProvider {
    const fallbacks = FALLBACK_RPC_URLS[this.networkId as keyof typeof FALLBACK_RPC_URLS] || []
    // Primary URL first, then fallbacks (excluding duplicates)
    const rpcUrls = [this.rpcUrl, ...fallbacks.filter((url) => url !== this.rpcUrl)]

    const providers = rpcUrls.map((url) => {
      // Apply API key headers only for fastnear.com URLs
      const isFastNear = url.includes("fastnear.com")
      const headers = isFastNear ? NEAR_CONFIG.rpcHeaders : {}

      return new JsonRpcProvider(
        {
          url,
          headers,
        },
        RPC_RETRY_OPTIONS,
      )
    })

    console.log(`[NearContractDB] Creating FailoverRpcProvider with ${providers.length} endpoints:`, rpcUrls)
    if (NEAR_CONFIG.rpcApiKey) {
      console.log(`[NearContractDB] Using FastNear API key for authenticated access`)
    }
    return new FailoverRpcProvider(providers)
  }

  private async init() {
    try {
      // KeyPair.fromString expects a string but the type definition is overly strict
      // Runtime accepts ed25519:... format strings which we use
      const keyPair = KeyPair.fromString(this.backendPrivateKey as `ed25519:${string}`)
      const signer = new KeyPairSigner(keyPair)

      // Create FailoverRpcProvider with multiple endpoints and retry logic
      this.provider = this.createFailoverProvider()

      // Account constructor types don't match the actual implementation
      // The provider and signer interfaces are compatible at runtime
      this.account = new Account(
        this.backendAccountId,
        this.provider as unknown as Provider,
        signer as unknown as Signer,
      )

      console.log(`[NearContractDB] Initialized with account: ${this.backendAccountId}`)
      console.log(`[NearContractDB] Contract ID: ${this.contractId}`)
      console.log(`[NearContractDB] Network: ${this.networkId}`)
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

  async isAccountVerified(nearAccountId: string): Promise<boolean> {
    await this.ensureInitialized()

    try {
      const result = await this.provider!.callFunction<boolean>(this.contractId, "is_account_verified", {
        near_account_id: nearAccountId,
      })

      return result ?? false
    } catch (error) {
      console.error("[NearContractDB] Error checking account:", error)
      throw error
    }
  }

  async storeVerification(data: VerificationDataWithSignature): Promise<void> {
    await this.ensureInitialized()

    try {
      // Extract NEAR signature data and Self proof from verification data
      const { signatureData, selfProofData, userContextData, ...verificationData } = data

      // Convert signature data to contract format
      const nearSigData: ContractSignatureInput = {
        account_id: signatureData.accountId,
        signature: Array.from(Buffer.from(signatureData.signature, "base64")),
        public_key: signatureData.publicKey,
        challenge: signatureData.challenge,
        nonce: signatureData.nonce, // Already an array
        recipient: signatureData.recipient,
      }

      // Convert Self proof data to contract format
      const selfProof: ContractSelfProofInput = {
        proof: selfProofData.proof,
        public_signals: selfProofData.publicSignals,
      }

      console.log("[NearContractDB] Calling store_verification on contract...")

      // Call contract method (will verify signature on-chain)
      // Use actionCreators.functionCall() to create proper Action objects
      const result = await this.account!.signAndSendTransaction({
        receiverId: this.contractId,
        actions: [
          actionCreators.functionCall(
            "store_verification",
            {
              nullifier: verificationData.nullifier,
              near_account_id: verificationData.nearAccountId,
              user_id: verificationData.userId,
              attestation_id: verificationData.attestationId,
              signature_data: nearSigData,
              self_proof: selfProof,
              user_context_data: userContextData,
            },
            BigInt("30000000000000"), // 30 TGas
            BigInt("0"), // 0 NEAR deposit
          ),
        ],
      })

      console.log("[NearContractDB] Verification stored on-chain:", {
        transactionHash: result.transaction.hash,
        nearAccountId: verificationData.nearAccountId,
      })
    } catch (error) {
      console.error("[NearContractDB] Error storing verification:", error)

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

  async getVerifiedAccount(nearAccountId: string): Promise<VerifiedAccount | null> {
    await this.ensureInitialized()

    try {
      const result = await this.provider!.callFunction<ContractVerifiedAccount>(
        this.contractId,
        "get_account_with_proof",
        {
          near_account_id: nearAccountId,
        },
      )

      if (!result) {
        return null
      }

      // Validate and transform contract response using Zod schema
      // Automatically converts snake_case to camelCase and nanoseconds to milliseconds
      return contractVerifiedAccountSchema.parse(result)
    } catch (error) {
      console.error("[NearContractDB] Error getting verified account:", error)
      // Return null for not found instead of throwing
      return null
    }
  }

  async getAllVerifiedAccounts(): Promise<VerifiedAccount[]> {
    await this.ensureInitialized()

    try {
      const count = await this.provider!.callFunction<number>(this.contractId, "get_verified_count", {})

      // Fetch all accounts using pagination (100 at a time)
      const allAccounts: VerifiedAccount[] = []
      const pageSize = 100

      for (let i = 0; i < (count ?? 0); i += pageSize) {
        const page = await this.provider!.callFunction<ContractVerifiedAccount[]>(
          this.contractId,
          "get_verified_accounts",
          {
            from_index: i,
            limit: pageSize,
          },
        )

        // Validate and transform each contract response using Zod schema
        const accounts = (page ?? []).map((item) => contractVerifiedAccountSchema.parse(item))

        allAccounts.push(...accounts)
      }

      return allAccounts
    } catch (error) {
      console.error("[NearContractDB] Error getting all verified accounts:", error)
      return []
    }
  }

  // Get paginated verified accounts (uses FailoverRpcProvider for automatic failover)
  async getVerifiedAccounts(
    fromIndex: number = 0,
    limit: number = 50,
  ): Promise<{ accounts: VerifiedAccount[]; total: number }> {
    await this.ensureInitialized()

    try {
      const [total, accounts] = await Promise.all([
        this.provider!.callFunction<number>(this.contractId, "get_verified_count", {}),
        this.provider!.callFunction<ContractVerifiedAccount[]>(this.contractId, "get_verified_accounts", {
          from_index: fromIndex,
          limit: Math.min(limit, 100),
        }),
      ])

      // Validate and transform each contract response using Zod schema
      const verifiedAccounts = (accounts ?? []).map((item) => contractVerifiedAccountSchema.parse(item))

      return { accounts: verifiedAccounts, total: total ?? 0 }
    } catch (error) {
      console.error("[NearContractDB] Error getting paginated accounts:", error)
      return { accounts: [], total: 0 }
    }
  }
}

// ============================================================================
// Singleton Database Instance (Lazy Initialization)
// ============================================================================

let dbInstance: IVerificationDatabase | null = null

function createVerificationContract(): IVerificationDatabase {
  const { verificationContractId, backendAccountId, backendPrivateKey, networkId, rpcUrl } = NEAR_CONFIG

  if (!verificationContractId || !backendAccountId || !backendPrivateKey) {
    throw new Error(
      "Missing required NEAR configuration. Please set:\n" +
        "- NEXT_PUBLIC_NEAR_VERIFICATION_CONTRACT (contract account address)\n" +
        "- NEAR_ACCOUNT_ID (backend wallet account)\n" +
        "- NEAR_PRIVATE_KEY (backend wallet private key)\n" +
        "See DEVELOPER.md for setup instructions.",
    )
  }

  console.log("[VerificationContract] Using NEAR smart contract")
  console.log(`[VerificationContract] Contract: ${verificationContractId}`)
  console.log(`[VerificationContract] Network: ${networkId}`)

  return new NearContractDatabase(backendAccountId, backendPrivateKey, verificationContractId, networkId, rpcUrl)
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
