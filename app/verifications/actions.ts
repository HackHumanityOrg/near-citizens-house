"use server"

import { db } from "@/lib/database"
import type { NearContractDatabase } from "@/lib/near-contract-db"
import { verifyStoredProofWithDetails } from "@/lib/zk-verify"
import { parseUserContextData, verifyNearSignature, buildProofData, type ProofData } from "@/lib/verify-utils"

export interface VerificationResult {
  zkValid: boolean
  signatureValid: boolean
  error?: string
}

export interface VerifiedAccountData {
  nearAccountId: string
  nullifier: string
  userId: string
  attestationId: string
  verifiedAt: number
  selfProof: {
    proof: {
      a: [string, string]
      b: [[string, string], [string, string]]
      c: [string, string]
    }
    publicSignals: string[]
  }
  userContextData: string
}

export interface VerifiedAccountWithStatus {
  account: VerifiedAccountData
  verification: VerificationResult
  proofData: ProofData | null
}

export interface GetVerifiedAccountsResult {
  accounts: VerifiedAccountWithStatus[]
  total: number
}

/**
 * Server action to get verified accounts with verification status.
 * All verification (ZK proof via Celo + NEAR signature) happens server-side.
 */
export async function getVerifiedAccountsWithStatus(
  page: number,
  pageSize: number,
): Promise<GetVerifiedAccountsResult> {
  const nearDb = db as NearContractDatabase

  // Get paginated accounts from NEAR contract
  const { accounts, total } = await nearDb.getVerifiedAccounts(page * pageSize, pageSize)

  // Verify each account in parallel
  const verifiedAccounts = await Promise.all(
    accounts.map(async (account): Promise<VerifiedAccountWithStatus> => {
      try {
        // 1. Verify ZK proof via Celo on-chain verifier
        const zkResult = await verifyStoredProofWithDetails(
          {
            proof: account.selfProof.proof,
            publicSignals: account.selfProof.publicSignals,
          },
          Number(account.attestationId),
        )

        // 2. Verify NEAR signature
        const sigData = parseUserContextData(account.userContextData)
        let signatureValid = false
        let signatureError: string | undefined

        if (sigData) {
          const sigResult = verifyNearSignature(
            "Identify myself",
            sigData.signature,
            sigData.publicKey,
            sigData.nonce,
            sigData.accountId,
          )
          signatureValid = sigResult.valid
          if (!sigResult.valid) {
            signatureError = sigResult.error
          }
        } else {
          signatureError = "Could not parse signature data from userContextData"
        }

        // 3. Build proof data for display
        const proofData = buildProofData(account, sigData)

        return {
          account: {
            nearAccountId: account.nearAccountId,
            nullifier: account.nullifier,
            userId: account.userId,
            attestationId: account.attestationId,
            verifiedAt: account.verifiedAt,
            selfProof: account.selfProof,
            userContextData: account.userContextData,
          },
          verification: {
            zkValid: zkResult.isValid,
            signatureValid,
            error: zkResult.error || signatureError,
          },
          proofData,
        }
      } catch (error) {
        return {
          account: {
            nearAccountId: account.nearAccountId,
            nullifier: account.nullifier,
            userId: account.userId,
            attestationId: account.attestationId,
            verifiedAt: account.verifiedAt,
            selfProof: account.selfProof,
            userContextData: account.userContextData,
          },
          verification: {
            zkValid: false,
            signatureValid: false,
            error: error instanceof Error ? error.message : "Verification failed",
          },
          proofData: null,
        }
      }
    }),
  )

  return { accounts: verifiedAccounts, total }
}
