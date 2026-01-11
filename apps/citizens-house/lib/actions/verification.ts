"use server"

import { verificationDb } from "@near-citizens/shared"

/**
 * Check if a NEAR account is verified
 *
 * Server action that queries the verified-accounts contract
 *
 * @param accountId - NEAR account ID to check
 * @returns true if the account is verified, false otherwise
 */
export async function checkVerificationStatus(accountId: string): Promise<boolean> {
  if (!accountId) {
    return false
  }

  try {
    const isVerified = await verificationDb.isVerified(accountId)
    console.log(`[Verification] Check status for ${accountId}: ${isVerified}`)
    return isVerified
  } catch (error) {
    console.error(`[Verification] Error checking status for ${accountId}:`, error)
    return false
  }
}
