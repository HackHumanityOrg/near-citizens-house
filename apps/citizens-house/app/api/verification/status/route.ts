/**
 * Verification Status Endpoint
 *
 * Returns the current verification status for an account.
 * Checks on-chain first, then Redis for intermediate webhook states.
 */
import { type NextRequest, NextResponse } from "next/server"
import { checkIsVerified } from "@/app/citizens/actions"
import { getVerificationStatus } from "@/lib/verification-status"
import { nearAccountIdSchema } from "@/lib/schemas"

export async function GET(request: NextRequest) {
  const accountIdParam = request.nextUrl.searchParams.get("accountId")

  const parsed = nearAccountIdSchema.safeParse(accountIdParam)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid accountId" }, { status: 400 })
  }
  const accountId = parsed.data

  // First check if already verified on-chain
  const isVerified = await checkIsVerified(accountId)
  if (isVerified) {
    return NextResponse.json({ status: "APPROVED" })
  }

  // Then check Redis for intermediate status
  const redisStatus = await getVerificationStatus(accountId)
  if (redisStatus) {
    return NextResponse.json({
      status: redisStatus.status,
      updatedAt: redisStatus.updatedAt,
      ...(redisStatus.rejectLabels && { rejectLabels: redisStatus.rejectLabels }),
      ...(redisStatus.moderationComment && { moderationComment: redisStatus.moderationComment }),
    })
  }

  return NextResponse.json({ status: "NOT_FOUND" })
}
