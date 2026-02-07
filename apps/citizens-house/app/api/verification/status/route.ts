/**
 * Verification Status Endpoint
 *
 * Returns the current verification status for an account.
 * Checks on-chain first, then Redis for intermediate webhook states.
 */
import * as Sentry from "@sentry/nextjs"
import { type NextRequest } from "next/server"
import { checkIsVerified } from "@/app/citizens/actions"
import { getVerificationStatus } from "@/lib/verification-status"
import { nearAccountIdSchema } from "@/lib/schemas"
import { verificationStatusResponseSchema } from "@/lib/schemas/api/verification"
import { apiError, apiSuccess } from "@/lib/api/response"
import { withLogging } from "@/lib/api/with-logging"

export const GET = withLogging({ route: "GET /api/verification/status" }, async (request: NextRequest, log) => {
  const accountIdParam = request.nextUrl.searchParams.get("accountId")

  const parsed = nearAccountIdSchema.safeParse(accountIdParam)
  if (!parsed.success) {
    log.setAll({
      error_code: "INVALID_REQUEST",
      validation_step: "account_id",
    })
    return apiError("INVALID_REQUEST", "Invalid accountId")
  }
  const accountId = parsed.data
  log.set("account_id", accountId)

  // First check if already verified on-chain
  const isVerified = await Sentry.startSpan(
    { name: "checkIsVerified", op: "db", attributes: { account_id: accountId } },
    () => checkIsVerified(accountId),
  )
  if (isVerified) {
    log.setAll({ status_result: "approved", source: "onchain" })
    const approvedResponse = verificationStatusResponseSchema.parse({ state: "approved" as const })
    return apiSuccess(approvedResponse)
  }

  // Then check Redis for intermediate status
  const redisStatus = await Sentry.startSpan(
    { name: "getVerificationStatus", op: "db.redis", attributes: { account_id: accountId } },
    () => getVerificationStatus(accountId),
  )
  if (redisStatus) {
    const responseData =
      redisStatus.state === "hold"
        ? {
            state: "hold" as const,
            updatedAt: redisStatus.updatedAt,
            errorCode: "VERIFICATION_ON_HOLD" as const,
          }
        : {
            state: "failed" as const,
            updatedAt: redisStatus.updatedAt,
            errorCode: redisStatus.errorCode,
          }
    // Validate response shape before returning (defensive)
    const validatedResponse = verificationStatusResponseSchema.safeParse(responseData)
    if (!validatedResponse.success) {
      Sentry.logger.warn("verification_status_invalid_shape", {
        account_id: accountId,
        validation_error: validatedResponse.error.message,
      })
      log.setAll({
        error_code: "STORAGE_FAILED",
        validation_step: "status_record",
      })
      return apiError("STORAGE_FAILED", "Invalid status data")
    }
    log.setAll({ status_result: redisStatus.state, source: "redis" })
    return apiSuccess(validatedResponse.data)
  }

  log.setAll({ status_result: "pending", source: "default" })
  const pendingResponse = verificationStatusResponseSchema.parse({ state: "pending" as const })
  return apiSuccess(pendingResponse)
})
