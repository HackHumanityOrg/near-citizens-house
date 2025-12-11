"use server"

import { bridgeContract, verificationDb, nearAccountIdSchema, type BridgeInfo } from "@near-citizens/shared"

/**
 * Get bridge contract configuration
 */
export async function getBridgeInfo(): Promise<BridgeInfo> {
  return bridgeContract.getInfo()
}

/**
 * Get the backend wallet address
 */
export async function getBackendWallet(): Promise<string> {
  return bridgeContract.getBackendWallet()
}

/**
 * Get the SputnikDAO contract address
 */
export async function getSputnikDaoAddress(): Promise<string> {
  return bridgeContract.getSputnikDao()
}

/**
 * Get the verified accounts contract address
 */
export async function getVerifiedAccountsContract(): Promise<string> {
  return bridgeContract.getVerifiedAccountsContract()
}

/**
 * Get the citizen role name
 */
export async function getCitizenRole(): Promise<string> {
  return bridgeContract.getCitizenRole()
}

/**
 * Check if an account is verified
 */
export async function checkVerificationStatus(accountId: string): Promise<boolean> {
  const parsed = nearAccountIdSchema.safeParse(accountId)
  if (!parsed.success) {
    console.error("[Server Action] Invalid account ID:", parsed.error.format())
    return false
  }

  try {
    return await verificationDb.isAccountVerified(parsed.data)
  } catch (error) {
    console.error("[Server Action] Error checking verification:", error)
    return false
  }
}
