// Redis-backed nonce store for replay protection
// Nonces are stored with automatic TTL expiration

import "server-only"

import { getRedisClient } from "./redis"
import type { NearAccountId } from "./schemas/near"

// Signature nonce TTL (10 minutes)
const NONCE_TTL_SECONDS = 10 * 60

function getNonceKey(accountId: NearAccountId, nonceBase64: string): string {
  return `self-nonce:${accountId}:${nonceBase64}`
}

export async function reserveSignatureNonce(
  accountId: NearAccountId,
  nonceBase64: string,
  ttlSeconds: number = NONCE_TTL_SECONDS,
): Promise<boolean> {
  const client = await getRedisClient()
  const key = getNonceKey(accountId, nonceBase64)
  const result = await client.set(key, "1", {
    EX: ttlSeconds,
    NX: true,
  })
  return result === "OK"
}
