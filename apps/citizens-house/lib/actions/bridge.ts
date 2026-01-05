"use server"

import { bridgeContract, verificationDb, nearAccountIdSchema, type BridgeInfo } from "@near-citizens/shared"

/**
 * Get bridge contract configuration
 */
export async function getBridgeInfo(): Promise<BridgeInfo | null> {
  try {
    return await bridgeContract.getInfo()
  } catch (error) {
    console.error("[Server Action] Error fetching bridge info:", error)
    return null
  }
}

/**
 * Get the backend wallet address
 */
export async function getBackendWallet(): Promise<string | null> {
  try {
    return await bridgeContract.getBackendWallet()
  } catch (error) {
    console.error("[Server Action] Error fetching backend wallet:", error)
    return null
  }
}

/**
 * Get the SputnikDAO contract address
 */
export async function getSputnikDaoAddress(): Promise<string | null> {
  try {
    return await bridgeContract.getSputnikDao()
  } catch (error) {
    console.error("[Server Action] Error fetching SputnikDAO address:", error)
    return null
  }
}

/**
 * Get the verified accounts contract address
 */
export async function getVerifiedAccountsContract(): Promise<string | null> {
  try {
    return await bridgeContract.getVerifiedAccountsContract()
  } catch (error) {
    console.error("[Server Action] Error fetching verified accounts contract:", error)
    return null
  }
}

/**
 * Get the citizen role name
 */
export async function getCitizenRole(): Promise<string | null> {
  try {
    return await bridgeContract.getCitizenRole()
  } catch (error) {
    console.error("[Server Action] Error fetching citizen role:", error)
    return null
  }
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
    return await verificationDb.isVerified(parsed.data)
  } catch (error) {
    console.error("[Server Action] Error checking verification:", error)
    return false
  }
}
