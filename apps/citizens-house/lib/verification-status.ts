/**
 * Verification Status Store
 *
 * Stores intermediate verification status in Redis for webhook-to-frontend communication.
 * Status is cleared once verification is finalized on-chain.
 */
import "server-only"

import { getRedisClient } from "@/lib/redis"
import { verificationStatusRecordSchema, type VerificationStatusRecord } from "@/lib/schemas/domain/verification"
import { type VerificationStatusErrorCode } from "@/lib/schemas/errors"
import { logEvent } from "@/lib/logger"

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
  await redis.set(key, JSON.stringify(value), { EX: STATUS_TTL_SECONDS })
  logEvent({
    event: "verification_status_set",
    level: "info",
    accountId,
    status: errorCode,
  })
}

export async function getVerificationStatus(accountId: string): Promise<VerificationStatusRecord | null> {
  const redis = await getRedisClient()
  const key = `${REDIS_KEY_PREFIX}${accountId}`
  const value = await redis.get(key)
  if (!value) return null

  const parsedValue = JSON.parse(value)
  const parsed = verificationStatusRecordSchema.safeParse(parsedValue)
  return parsed.success ? parsed.data : null
}

export async function clearVerificationStatus(accountId: string): Promise<void> {
  const redis = await getRedisClient()
  const key = `${REDIS_KEY_PREFIX}${accountId}`
  await redis.del(key)
  logEvent({
    event: "verification_status_cleared",
    level: "info",
    accountId,
  })
}
