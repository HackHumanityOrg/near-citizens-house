/**
 * SumSub API Provider (Server-only)
 *
 * This module provides authenticated access to the SumSub API for:
 * - Generating access tokens for WebSDK initialization
 * - Fetching applicant data and metadata
 * - Updating applicant metadata
 *
 * Authentication uses HMAC-SHA256 signature as per SumSub docs.
 * @see https://docs.sumsub.com/reference/authentication
 */
import "server-only"

import crypto from "crypto"
import { env } from "../schemas/env"
import { logger } from "../logger"
import {
  sumsubAccessTokenApiResponseSchema,
  sumsubApplicantSchema,
  type SumSubAccessTokenApiResponse,
  type SumSubApplicant,
  type SumSubMetadataItem,
} from "../schemas/sumsub"

// ==============================================================================
// Configuration
// ==============================================================================

const SUMSUB_BASE_URL = "https://api.sumsub.com"

/**
 * RFC 3986 compliant URI encoding.
 *
 * JavaScript's encodeURIComponent doesn't encode !'()* as they're "unreserved" per RFC 3986,
 * but SumSub requires these encoded for signature matching.
 */
function encodeRFC3986(str: string): string {
  return encodeURIComponent(str).replace(/[!'()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase())
}

// Get credentials from environment
function getCredentials() {
  const appToken = env.SUMSUB_APP_TOKEN
  const secretKey = env.SUMSUB_SECRET_KEY

  if (!appToken || !secretKey) {
    throw new Error("SumSub credentials not configured: SUMSUB_APP_TOKEN and SUMSUB_SECRET_KEY required")
  }

  return { appToken, secretKey }
}

// ==============================================================================
// HMAC Signature Generation
// ==============================================================================

/**
 * Generate HMAC-SHA256 signature for SumSub API authentication.
 *
 * The signature is computed over: timestamp + method + path + body
 * @see https://docs.sumsub.com/reference/authentication
 */
function generateSignature(secretKey: string, timestamp: number, method: string, path: string, body?: string): string {
  const data = timestamp + method.toUpperCase() + path + (body || "")
  return crypto.createHmac("sha256", secretKey).update(data).digest("hex")
}

/**
 * Get authentication headers for SumSub API requests.
 */
function getAuthHeaders(method: string, path: string, body?: string): Record<string, string> {
  const { appToken, secretKey } = getCredentials()
  const timestamp = Math.floor(Date.now() / 1000)
  const signature = generateSignature(secretKey, timestamp, method, path, body)

  return {
    "X-App-Token": appToken,
    "X-App-Access-Sig": signature,
    "X-App-Access-Ts": timestamp.toString(),
    "Content-Type": "application/json",
  }
}

// ==============================================================================
// API Methods
// ==============================================================================

/**
 * Create a new applicant explicitly.
 *
 * This ensures the applicant exists before we try to update metadata,
 * avoiding the race condition where SumSub creates applicants asynchronously.
 *
 * @param externalUserId - Unique user identifier (we use NEAR account ID)
 * @param levelName - Verification level name configured in SumSub dashboard
 * @returns Applicant data
 */
export async function createApplicant(externalUserId: string, levelName: string): Promise<SumSubApplicant> {
  const path = `/resources/applicants?levelName=${encodeRFC3986(levelName)}`
  const method = "POST"
  const body = JSON.stringify({ externalUserId })
  const headers = getAuthHeaders(method, path, body)

  const response = await fetch(`${SUMSUB_BASE_URL}${path}`, {
    method,
    headers,
    body,
  })

  if (!response.ok) {
    const errorText = await response.text()
    logger.error("sumsub_create_applicant_failed", {
      status: response.status,
      error: errorText,
      externalUserId,
    })
    throw new Error(`Failed to create applicant: ${response.status} - ${errorText}`)
  }

  const data = await response.json()
  const parsed = sumsubApplicantSchema.safeParse(data)

  if (!parsed.success) {
    logger.error("sumsub_create_applicant_invalid_response", {
      error: parsed.error.message,
    })
    throw new Error("Invalid response from SumSub create applicant API")
  }

  logger.info("sumsub_applicant_created", {
    applicantId: parsed.data.id,
    externalUserId,
  })

  return parsed.data
}

/**
 * Generate an access token for the SumSub WebSDK.
 *
 * @param externalUserId - Unique user identifier (we use NEAR account ID)
 * @param levelName - Verification level name configured in SumSub dashboard
 * @returns Access token and user ID
 */
export async function generateAccessToken(
  externalUserId: string,
  levelName: string,
): Promise<SumSubAccessTokenApiResponse> {
  const path = `/resources/accessTokens?userId=${encodeURIComponent(externalUserId)}&levelName=${encodeRFC3986(levelName)}`
  const method = "POST"
  const headers = getAuthHeaders(method, path)

  const response = await fetch(`${SUMSUB_BASE_URL}${path}`, {
    method,
    headers,
  })

  if (!response.ok) {
    const errorText = await response.text()
    logger.error("sumsub_access_token_failed", {
      status: response.status,
      error: errorText,
      externalUserId,
    })
    throw new Error(`SumSub access token generation failed: ${response.status} - ${errorText}`)
  }

  const data = await response.json()
  const parsed = sumsubAccessTokenApiResponseSchema.safeParse(data)

  if (!parsed.success) {
    logger.error("sumsub_access_token_invalid_response", {
      error: parsed.error.message,
      response: data,
    })
    throw new Error("Invalid response from SumSub access token API")
  }

  return parsed.data
}

/**
 * Get applicant data by applicant ID.
 *
 * @param applicantId - SumSub applicant ID
 * @returns Applicant data including metadata
 */
export async function getApplicant(applicantId: string): Promise<SumSubApplicant> {
  const path = `/resources/applicants/${encodeURIComponent(applicantId)}/one`
  const method = "GET"
  const headers = getAuthHeaders(method, path)

  const response = await fetch(`${SUMSUB_BASE_URL}${path}`, {
    method,
    headers,
  })

  if (!response.ok) {
    const errorText = await response.text()
    logger.error("sumsub_get_applicant_failed", {
      status: response.status,
      error: errorText,
      applicantId,
    })
    throw new Error(`SumSub get applicant failed: ${response.status} - ${errorText}`)
  }

  const data = await response.json()
  const parsed = sumsubApplicantSchema.safeParse(data)

  if (!parsed.success) {
    logger.error("sumsub_get_applicant_invalid_response", {
      error: parsed.error.message,
      response: data,
    })
    throw new Error("Invalid response from SumSub get applicant API")
  }

  return parsed.data
}

/**
 * Get applicant data by external user ID.
 *
 * @param externalUserId - External user ID (NEAR account ID)
 * @returns Applicant data including metadata
 */
export async function getApplicantByExternalUserId(externalUserId: string): Promise<SumSubApplicant> {
  const path = `/resources/applicants/-;externalUserId=${encodeURIComponent(externalUserId)}/one`
  const method = "GET"
  const headers = getAuthHeaders(method, path)

  const response = await fetch(`${SUMSUB_BASE_URL}${path}`, {
    method,
    headers,
  })

  if (!response.ok) {
    const errorText = await response.text()
    logger.error("sumsub_get_applicant_by_external_id_failed", {
      status: response.status,
      error: errorText,
      externalUserId,
    })
    throw new Error(`SumSub get applicant by external ID failed: ${response.status} - ${errorText}`)
  }

  const data = await response.json()
  const parsed = sumsubApplicantSchema.safeParse(data)

  if (!parsed.success) {
    logger.error("sumsub_get_applicant_by_external_id_invalid_response", {
      error: parsed.error.message,
      response: data,
    })
    throw new Error("Invalid response from SumSub get applicant API")
  }

  return parsed.data
}

/**
 * Update applicant metadata.
 *
 * Metadata is stored as key-value pairs on the applicant record.
 * We use this to store NEAR signature data for later verification.
 *
 * @param applicantId - SumSub applicant ID
 * @param metadata - Array of key-value pairs to set
 */
export async function updateApplicantMetadata(applicantId: string, metadata: SumSubMetadataItem[]): Promise<void> {
  // SumSub API requires PATCH to /resources/applicants with ID in body
  // See: https://docs.sumsub.com/reference/change-profile-data-details
  const path = `/resources/applicants`
  const method = "PATCH"
  const body = JSON.stringify({
    id: applicantId,
    metadata: metadata,
  })
  const headers = getAuthHeaders(method, path, body)

  const response = await fetch(`${SUMSUB_BASE_URL}${path}`, {
    method,
    headers,
    body,
  })

  if (!response.ok) {
    const errorText = await response.text()
    logger.error("sumsub_update_metadata_failed", {
      status: response.status,
      error: errorText,
      applicantId,
    })
    throw new Error(`SumSub update metadata failed: ${response.status} - ${errorText}`)
  }
}

// ==============================================================================
// Webhook Signature Verification
// ==============================================================================

/**
 * Verify SumSub webhook HMAC signature.
 *
 * @param payload - Raw webhook body as string
 * @param signature - Signature from x-payload-digest header
 * @returns true if signature is valid
 */
export function verifyWebhookSignature(payload: string, signature: string): boolean {
  const webhookSecret = env.SUMSUB_WEBHOOK_SECRET

  if (!webhookSecret) {
    logger.error("sumsub_webhook_secret_not_configured", {})
    throw new Error("SumSub webhook secret not configured")
  }

  const expectedSignature = crypto.createHmac("sha256", webhookSecret).update(payload).digest("hex")

  // Use timing-safe comparison to prevent timing attacks
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))
  } catch {
    // Lengths don't match
    return false
  }
}

/**
 * Extract metadata value by key from applicant metadata array.
 *
 * @param metadata - Array of metadata items
 * @param key - Key to look up
 * @returns Value if found, undefined otherwise
 */
export function getMetadataValue(metadata: SumSubMetadataItem[] | undefined, key: string): string | undefined {
  if (!metadata) return undefined
  const item = metadata.find((m) => m.key === key)
  return item?.value
}
