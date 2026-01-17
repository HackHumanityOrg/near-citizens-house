"use server"

import { verificationDb } from "@near-citizens/shared/contracts/verification/client"
import { nearAccountIdSchema, type NearAccountId } from "@near-citizens/shared"

/**
 * Check if a NEAR account is verified
 *
 * Server action that queries the verified-accounts contract
 *
 * @param accountId - NEAR account ID to check (must be validated NearAccountId)
 * @returns true if the account is verified, false otherwise
 */
export async function checkVerificationStatus(accountId: NearAccountId): Promise<boolean> {
  // Runtime validation for security (server actions can receive arbitrary input)
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
