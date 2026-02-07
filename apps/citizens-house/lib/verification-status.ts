/**
 * Verification Status Store
 *
 * Stores intermediate verification status in Redis for webhook-to-frontend communication.
 * Status is cleared once verification is finalized on-chain.
 */
import "server-only"

import * as Sentry from "@sentry/nextjs"
import { getRedisClient } from "@/lib/redis"
import { verificationStatusRecordSchema, type VerificationStatusRecord } from "@/lib/schemas/domain/verification"
import { type VerificationStatusErrorCode } from "@/lib/schemas/errors"

const REDIS_KEY_PREFIX = "verification:status:"
const STATUS_TTL_SECONDS = 72 * 60 * 60 // 72 hours

export async function setVerificationStatus(accountId: string, errorCode: VerificationStatusErrorCode): Promise<void> {
  const redis = await getRedisClient()
  const key = `${REDIS_KEY_PREFIX}${accountId}`
  const value: VerificationStatusRecord = {
    state: errorCode === "VERIFICATION_ON_HOLD" ? "hold" : "failed",
    updatedAt: Date.now(),
    errorCode,
  }
  await Sentry.startSpan(
    {
      name: "redis.set.verificationStatus",
      op: "db.redis",
      attributes: {
        account_id: accountId,
        status_error_code: errorCode,
        ttl_seconds: STATUS_TTL_SECONDS,
      },
    },
    () => redis.set(key, JSON.stringify(value), { EX: STATUS_TTL_SECONDS }),
  )
  Sentry.logger.info("verification_status_set", { account_id: accountId, status: errorCode })
}

export async function getVerificationStatus(accountId: string): Promise<VerificationStatusRecord | null> {
  const redis = await getRedisClient()
  const key = `${REDIS_KEY_PREFIX}${accountId}`
  const value = await Sentry.startSpan(
    {
      name: "redis.get.verificationStatus",
      op: "db.redis",
      attributes: { account_id: accountId },
    },
    () => redis.get(key),
  )
  if (!value) return null

  const parsedValue = JSON.parse(value)
  const parsed = verificationStatusRecordSchema.safeParse(parsedValue)
  if (!parsed.success) {
    Sentry.logger.warn("verification_status_invalid_record", {
      account_id: accountId,
      validation_error: parsed.error.message,
    })
  }
  return parsed.success ? parsed.data : null
}

export async function clearVerificationStatus(accountId: string): Promise<void> {
  const redis = await getRedisClient()
  const key = `${REDIS_KEY_PREFIX}${accountId}`
  await Sentry.startSpan(
    {
      name: "redis.del.verificationStatus",
      op: "db.redis",
      attributes: { account_id: accountId },
    },
    () => redis.del(key),
  )
  Sentry.logger.info("verification_status_cleared", { account_id: accountId })
}
