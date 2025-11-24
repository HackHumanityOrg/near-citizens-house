// Database abstraction for verified passport-wallet associations
// Uses NEAR smart contract for permanent, decentralized storage

import { NearContractDatabase } from "./near-contract-db"
import type { NearSignatureData, SelfProofData } from "./types"

export interface VerifiedAccount {
  nullifier: string // Unique passport identifier (prevents duplicate registrations)
  nearAccountId: string // Associated NEAR wallet
  userId: string
  attestationId: string
  verifiedAt: number
  selfProof: SelfProofData // Self.xyz ZK proof for async verification
  userContextData: string // Original hex-encoded userContextData for Self.xyz re-verification
}

export interface VerificationData {
  nullifier: string
  nearAccountId: string
  userId: string
  attestationId: string
}

// Verification data with NEAR signature and Self proof for on-chain verification
export interface VerificationDataWithSignature extends VerificationData {
  signatureData: NearSignatureData
  selfProofData: SelfProofData
  userContextData: string // Original hex-encoded userContextData
}

export interface IVerificationDatabase {
  isNullifierUsed(nullifier: string): Promise<boolean>
  isAccountVerified(nearAccountId: string): Promise<boolean>
  storeVerification(data: VerificationDataWithSignature): Promise<void>
  getVerifiedAccount(nearAccountId: string): Promise<VerifiedAccount | null>
  getAllVerifiedAccounts(): Promise<VerifiedAccount[]>
}

// Create NEAR contract database instance
function createContractDatabase(): IVerificationDatabase {
  const contractId = process.env.NEAR_CONTRACT_ID
  const backendAccountId = process.env.NEAR_ACCOUNT_ID
  const backendPrivateKey = process.env.NEAR_PRIVATE_KEY
  const networkId = process.env.NEXT_PUBLIC_NEAR_NETWORK || "testnet"
  const rpcUrl = process.env.NEXT_PUBLIC_NEAR_RPC_URL || "https://rpc.testnet.near.org"

  if (!contractId || !backendAccountId || !backendPrivateKey) {
    throw new Error(
      "Missing required NEAR configuration. Please set:\n" +
        "- NEAR_CONTRACT_ID (contract account address)\n" +
        "- NEAR_ACCOUNT_ID (backend wallet account)\n" +
        "- NEAR_PRIVATE_KEY (backend wallet private key)\n" +
        "See NEAR_DEPLOYMENT.md for setup instructions.",
    )
  }

  console.log("[Database] Using NEAR smart contract backend")
  console.log(`[Database] Contract: ${contractId}`)
  console.log(`[Database] Network: ${networkId}`)

  return new NearContractDatabase(backendAccountId, backendPrivateKey, contractId, networkId, rpcUrl)
}

export const db: IVerificationDatabase = createContractDatabase()

export async function storeVerifiedAccount(data: VerificationDataWithSignature): Promise<void> {
  await db.storeVerification(data)
}

export async function getVerifiedAccount(nearAccountId: string): Promise<VerifiedAccount | null> {
  return db.getVerifiedAccount(nearAccountId)
}

export async function isAccountVerified(nearAccountId: string): Promise<boolean> {
  return db.isAccountVerified(nearAccountId)
}

export async function getAllVerifiedAccounts(): Promise<VerifiedAccount[]> {
  return db.getAllVerifiedAccounts()
}
