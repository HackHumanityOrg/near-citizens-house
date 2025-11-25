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
import { JsonRpcProvider } from "@near-js/providers"
import { KeyPairSigner } from "@near-js/signers"
import { actionCreators } from "@near-js/transactions"
import type { IVerificationDatabase, VerificationDataWithSignature, VerifiedAccount } from "./database"

// Contract ZK proof structure (matches Rust ZkProof)
interface ContractZkProof {
  a: [string, string]
  b: [[string, string], [string, string]]
  c: [string, string]
}

// Contract Self proof data (matches Rust SelfProofData)
interface ContractSelfProofData {
  proof: ContractZkProof
  public_signals: string[]
}

// Contract return type for verified account data (matches Rust struct)
interface ContractVerifiedAccount {
  nullifier: string
  near_account_id: string
  user_id: string
  attestation_id: string
  verified_at: number // Nanoseconds
  self_proof: ContractSelfProofData
  user_context_data: string // Original hex-encoded userContextData
}

// NEAR signature data format for contract verification (matches Rust struct)
// Renamed to avoid confusion with NearSignatureData in types.ts
interface NearContractSignatureData {
  account_id: string
  signature: number[] // Vec<u8> in Rust
  public_key: string
  challenge: string
  nonce: number[] // Vec<u8> - 32 bytes
  recipient: string
}

export class NearContractDatabase implements IVerificationDatabase {
  private account: Account | null = null
  private provider: JsonRpcProvider | null = null
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

  private async init() {
    try {
      // KeyPair.fromString expects a string but the type definition is overly strict
      // Runtime accepts ed25519:... format strings which we use
      const keyPair = KeyPair.fromString(this.backendPrivateKey as `ed25519:${string}`)
      const signer = new KeyPairSigner(keyPair)

      this.provider = new JsonRpcProvider({ url: this.rpcUrl })

      // Account constructor types don't match the actual implementation
      // The provider and signer interfaces are compatible at runtime
      this.account = new Account(
        this.backendAccountId,
        this.provider as unknown as Provider,
        signer as unknown as Signer,
      )

      console.log(`[NearContractDB] Initialized with account: ${this.backendAccountId}`)
      console.log(`[NearContractDB] Contract ID: ${this.contractId}`)
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

  async isNullifierUsed(nullifier: string): Promise<boolean> {
    await this.ensureInitialized()

    try {
      const result = await this.provider!.callFunction<boolean>(this.contractId, "is_nullifier_used", { nullifier })

      return result ?? false
    } catch (error) {
      console.error("[NearContractDB] Error checking nullifier:", error)
      throw error
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
      const nearSigData: NearContractSignatureData = {
        account_id: signatureData.accountId,
        signature: Array.from(Buffer.from(signatureData.signature, "base64")),
        public_key: signatureData.publicKey,
        challenge: signatureData.challenge,
        nonce: signatureData.nonce, // Already an array
        recipient: signatureData.recipient,
      }

      // Convert Self proof data to contract format
      const selfProof: ContractSelfProofData = {
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
        "get_verified_account",
        {
          near_account_id: nearAccountId,
        },
      )

      if (!result) {
        return null
      }

      // Convert from contract format to application format
      return {
        nullifier: result.nullifier,
        nearAccountId: result.near_account_id,
        userId: result.user_id,
        attestationId: result.attestation_id,
        verifiedAt: Math.floor(result.verified_at / 1_000_000), // Convert nanoseconds to milliseconds
        selfProof: {
          proof: result.self_proof.proof,
          publicSignals: result.self_proof.public_signals,
        },
        userContextData: result.user_context_data,
      }
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

        const accounts = (page ?? []).map((item) => ({
          nullifier: item.nullifier,
          nearAccountId: item.near_account_id,
          userId: item.user_id,
          attestationId: item.attestation_id,
          verifiedAt: Math.floor(item.verified_at / 1_000_000), // Convert nanoseconds to milliseconds
          selfProof: {
            proof: item.self_proof.proof,
            publicSignals: item.self_proof.public_signals,
          },
          userContextData: item.user_context_data,
        }))

        allAccounts.push(...accounts)
      }

      return allAccounts
    } catch (error) {
      console.error("[NearContractDB] Error getting all verified accounts:", error)
      return []
    }
  }

  // Get paginated verified accounts
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

      const verifiedAccounts = (accounts ?? []).map((item) => ({
        nullifier: item.nullifier,
        nearAccountId: item.near_account_id,
        userId: item.user_id,
        attestationId: item.attestation_id,
        verifiedAt: Math.floor(item.verified_at / 1_000_000), // Convert nanoseconds to milliseconds
        selfProof: {
          proof: item.self_proof.proof,
          publicSignals: item.self_proof.public_signals,
        },
        userContextData: item.user_context_data,
      }))

      return { accounts: verifiedAccounts, total: total ?? 0 }
    } catch (error) {
      console.error("[NearContractDB] Error getting paginated accounts:", error)
      return { accounts: [], total: 0 }
    }
  }
}
