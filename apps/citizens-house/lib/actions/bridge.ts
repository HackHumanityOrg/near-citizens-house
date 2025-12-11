"use server"

import { z } from "zod"
import { bridgeContract, verificationDb, type BridgeInfo } from "@near-citizens/shared"

// NEAR account ID: 2-64 chars, lowercase alphanumeric + separators (._-), cannot start/end with separator
const nearAccountIdSchema = z
  .string()
  .min(2)
  .max(64)
  .regex(/^[a-z0-9]([a-z0-9._-]*[a-z0-9])?$/)
  .refine((s) => !/[._-]{2}/.test(s), "Cannot have consecutive separators")

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
    console.error("[Server Action] Invalid account ID:", z.treeifyError(parsed.error))
    return false
  }

  try {
    return await verificationDb.isAccountVerified(parsed.data)
  } catch (error) {
    console.error("[Server Action] Error checking verification:", error)
    return false
  }
}
