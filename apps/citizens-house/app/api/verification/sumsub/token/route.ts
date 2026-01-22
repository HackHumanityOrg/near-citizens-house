/**
 * SumSub Access Token API
 *
 * Generates an access token for the SumSub WebSDK and stores NEAR signature
 * metadata on the applicant for verification when the webhook is received.
 */
import { type NextRequest, NextResponse } from "next/server"
import {
  generateAccessToken,
  updateApplicantMetadata,
  getApplicantByExternalUserId,
} from "@/lib/providers/sumsub-provider"
import { createSession } from "@/lib/session-store"
import { env } from "@/lib/schemas/env"
import { sumsubTokenRequestSchema, type SumSubTokenResponse, type SumSubMetadataItem } from "@/lib/schemas/sumsub"
import { logger } from "@/lib/logger"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate request
    const parseResult = sumsubTokenRequestSchema.safeParse(body)
    if (!parseResult.success) {
      const issues = parseResult.error.issues.map((i) => i.path.join(".")).join(", ")
      return NextResponse.json({ error: "Invalid request", details: issues }, { status: 400 })
    }

    const { sessionId, nearSignature } = parseResult.data

    // Use NEAR account ID as external user ID in SumSub
    const externalUserId = nearSignature.accountId
    const levelName = env.NEXT_PUBLIC_SUMSUB_LEVEL_NAME

    // Create session for polling
    await createSession(sessionId)

    // Generate SumSub access token
    const tokenResponse = await generateAccessToken(externalUserId, levelName)

    // Store NEAR signature data as metadata on the applicant
    // First, we need to get the applicant ID (created by generateAccessToken)
    try {
      const applicant = await getApplicantByExternalUserId(externalUserId)

      const metadata: SumSubMetadataItem[] = [
        { key: "near_account_id", value: nearSignature.accountId },
        { key: "near_signature", value: nearSignature.signature },
        { key: "near_public_key", value: nearSignature.publicKey },
        { key: "near_nonce", value: nearSignature.nonce },
        { key: "near_timestamp", value: nearSignature.timestamp.toString() },
        { key: "session_id", value: sessionId },
      ]

      await updateApplicantMetadata(applicant.id, metadata)

      logger.info("sumsub_token_generated", {
        sessionId,
        externalUserId,
        applicantId: applicant.id,
      })
    } catch (metadataError) {
      // Log but don't fail - the applicant might not exist yet
      // Metadata will be retrieved from the webhook payload instead
      logger.warn("sumsub_metadata_update_skipped", {
        sessionId,
        externalUserId,
        error: metadataError instanceof Error ? metadataError.message : "Unknown error",
      })
    }

    const response: SumSubTokenResponse = {
      token: tokenResponse.token,
      externalUserId,
    }

    return NextResponse.json(response)
  } catch (error) {
    logger.error("sumsub_token_error", {
      error: error instanceof Error ? error.message : "Unknown error",
    })

    return NextResponse.json({ error: "Failed to generate access token" }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    status: "ok",
    message: "SumSub token API",
    timestamp: new Date().toISOString(),
  })
}
