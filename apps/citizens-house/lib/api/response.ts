/**
 * Typed API Response Builders
 *
 * Thin wrappers around NextResponse.json() that leverage existing error infrastructure.
 */
import { NextResponse } from "next/server"
import { type VerificationErrorCode, createVerificationError, isNonRetryableError } from "@/lib/schemas/errors"
import { webhookAckResponseSchema } from "@/lib/schemas/api/response"

/**
 * Create a typed error response using existing error infrastructure.
 * Status is auto-determined: non-retryable = 400, retryable = 500.
 */
export function apiError(code: VerificationErrorCode, details?: string, statusOverride?: number): NextResponse {
  const status = statusOverride ?? (isNonRetryableError(code) ? 400 : 500)
  return NextResponse.json(createVerificationError(code, details), { status })
}

/**
 * Create a typed success response.
 */
export function apiSuccess<T>(data: T, status = 200): NextResponse<T> {
  return NextResponse.json(data, { status })
}

/**
 * Create a webhook acknowledgment response.
 */
export function webhookAck(message: string, accountId?: string): NextResponse {
  const payload = webhookAckResponseSchema.parse({
    status: "ok",
    message,
    ...(accountId && { accountId }),
  })
  return NextResponse.json(payload)
}
