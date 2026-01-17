"use server"

import { verificationDb } from "@near-citizens/shared/contracts/verification/client"
import { nearAccountIdSchema } from "@near-citizens/shared"

/**
 * Check if a NEAR account is verified
 *
 * Server action that queries the verified-accounts contract
 *
 * @param accountId - NEAR account ID to check
 * @returns true if the account is verified, false otherwise
 */
export async function checkVerificationStatus(accountId: string): Promise<boolean> {
  // Validate account ID format
  const parsed = nearAccountIdSchema.safeParse(accountId)
  if (!parsed.success) {
    return false
  }

  try {
    return await verificationDb.isVerified(parsed.data)
  } catch {
    return false
  }
}
