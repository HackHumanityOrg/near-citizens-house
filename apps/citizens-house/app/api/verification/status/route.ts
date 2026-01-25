/**
 * Verification Status Endpoint
 *
 * Returns the current verification status for an account.
 * Checks on-chain first, then Redis for intermediate webhook states.
 */
import { type NextRequest } from "next/server"
import { checkIsVerified } from "@/app/citizens/actions"
import { getVerificationStatus } from "@/lib/verification-status"
import { nearAccountIdSchema, verificationStatusResponseSchema } from "@/lib/schemas"
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
    return apiSuccess({ status: "APPROVED" as const })
  }

  // Then check Redis for intermediate status
  const redisStatus = await getVerificationStatus(accountId)
  if (redisStatus) {
    const responseData = {
      status: redisStatus.status,
      updatedAt: redisStatus.updatedAt,
      ...(redisStatus.rejectLabels && { rejectLabels: redisStatus.rejectLabels }),
      ...(redisStatus.moderationComment && { moderationComment: redisStatus.moderationComment }),
    }
    // Validate response shape before returning (defensive)
    const validatedResponse = verificationStatusResponseSchema.safeParse(responseData)
    if (!validatedResponse.success) {
      console.error("Invalid status response shape", validatedResponse.error)
      return apiError("STORAGE_FAILED", "Invalid status data")
    }
    return apiSuccess(validatedResponse.data)
  }

  return apiSuccess({ status: "NOT_FOUND" as const })
}
