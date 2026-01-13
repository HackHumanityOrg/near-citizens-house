"use server"

import { verificationDb } from "@near-citizens/shared/contracts/verification/client"
import { logger, LogScope, Op } from "@/lib/logger"

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
    logger.info("Verification status checked", {
      scope: LogScope.VERIFICATION,
      operation: Op.VERIFICATION.CHECK_STATUS,
      account_id: accountId,
      is_verified: isVerified,
    })
    return isVerified
  } catch (error) {
    const errorDetails =
      error instanceof Error
        ? { error_type: error.name, error_message: error.message, error_stack: error.stack }
        : { error_message: String(error) }

    logger.error("Failed to check verification status", {
      scope: LogScope.VERIFICATION,
      operation: Op.VERIFICATION.CHECK_STATUS,
      account_id: accountId,
      ...errorDetails,
    })
    return false
  }
}
