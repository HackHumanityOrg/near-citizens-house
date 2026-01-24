/**
 * Verification Status Store
 *
 * Stores intermediate verification status in Redis for webhook-to-frontend communication.
 * Status is cleared once verification is finalized on-chain.
 */
import "server-only"

import { getRedisClient } from "@/lib/redis"
import { webhookStatusSchema, type WebhookStatusCode, type WebhookStatus } from "@/lib/schemas"
import { logEvent } from "@/lib/logger"

const REDIS_KEY_PREFIX = "verification:status:"
const STATUS_TTL_SECONDS = 72 * 60 * 60 // 72 hours

export async function setVerificationStatus(
  accountId: string,
  status: WebhookStatusCode,
  details?: { rejectLabels?: string[]; moderationComment?: string },
): Promise<void> {
  const redis = await getRedisClient()
  const key = `${REDIS_KEY_PREFIX}${accountId}`
  const value: WebhookStatus = {
    status,
    updatedAt: Date.now(),
    ...details,
  }
  await redis.set(key, JSON.stringify(value), { EX: STATUS_TTL_SECONDS })
  logEvent({
    event: "verification_status_set",
    level: "info",
    accountId,
    status,
  })
}

export async function getVerificationStatus(accountId: string): Promise<WebhookStatus | null> {
  const redis = await getRedisClient()
  const key = `${REDIS_KEY_PREFIX}${accountId}`
  const value = await redis.get(key)
  if (!value) return null

  const parsed = webhookStatusSchema.safeParse(JSON.parse(value))
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
