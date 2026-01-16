"use server"

import { verificationDb } from "@near-citizens/shared/contracts/verification/client"

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
    return await verificationDb.isVerified(accountId)
  } catch {
    return false
  }
}
