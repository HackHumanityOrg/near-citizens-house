/**
 * Verification Status Endpoint
 *
 * Returns the current verification status for an account.
 * Checks on-chain first, then Redis for intermediate webhook states.
 */
import { type NextRequest } from "next/server"
import { checkIsVerified } from "@/app/citizens/actions"
import { getVerificationStatus } from "@/lib/verification-status"
import { nearAccountIdSchema } from "@/lib/schemas"
import { verificationStatusResponseSchema } from "@/lib/schemas/api/verification"
import { apiError, apiSuccess } from "@/lib/api/response"

export async function GET(request: NextRequest) {
  const accountIdParam = request.nextUrl.searchParams.get("accountId")

  const parsed = nearAccountIdSchema.safeParse(accountIdParam)
  if (!parsed.success) {
    return apiError("INVALID_REQUEST", "Invalid accountId")
  }
  const accountId = parsed.data

  // First check if already verified on-chain
  const isVerified = await checkIsVerified(accountId)
  if (isVerified) {
    const approvedResponse = verificationStatusResponseSchema.parse({ state: "approved" as const })
    return apiSuccess(approvedResponse)
  }

  // Then check Redis for intermediate status
  const redisStatus = await getVerificationStatus(accountId)
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
      console.error("Invalid status response shape", validatedResponse.error)
      return apiError("STORAGE_FAILED", "Invalid status data")
    }
    return apiSuccess(validatedResponse.data)
  }

  const pendingResponse = verificationStatusResponseSchema.parse({ state: "pending" as const })
  return apiSuccess(pendingResponse)
}
