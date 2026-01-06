// Redis-backed session store for tracking verification status
// Sessions are stored with automatic TTL expiration

import { getRedisClient } from "./redis"

type SessionStatus = "pending" | "success" | "error"

interface Session {
  status: SessionStatus
  accountId?: string
  error?: string
  errorCode?: string
  timestamp: number
}

// Session expiration time (5 minutes)
const SESSION_TTL_SECONDS = 5 * 60
// Signature nonce TTL (10 minutes)
const NONCE_TTL_SECONDS = 10 * 60

function getSessionKey(sessionId: string): string {
  return `self-session:${sessionId}`
}

export async function createSession(sessionId: string): Promise<void> {
  const client = await getRedisClient()
  const session: Session = {
    status: "pending",
    timestamp: Date.now(),
  }
  await client.set(getSessionKey(sessionId), JSON.stringify(session), {
    EX: SESSION_TTL_SECONDS,
  })
}

export async function getSession(sessionId: string): Promise<Session | null> {
  const client = await getRedisClient()
  const data = await client.get(getSessionKey(sessionId))
  if (!data) return null
  return JSON.parse(data) as Session
}

export async function updateSession(
  sessionId: string,
  update: { status: SessionStatus; accountId?: string; error?: string; errorCode?: string },
): Promise<void> {
  const client = await getRedisClient()
  const key = getSessionKey(sessionId)
  const existing = await client.get(key)

  const session: Session = existing
    ? { ...JSON.parse(existing), ...update, timestamp: Date.now() }
    : {
        status: update.status,
        accountId: update.accountId,
        error: update.error,
        errorCode: update.errorCode,
        timestamp: Date.now(),
      }

  await client.set(key, JSON.stringify(session), {
    EX: SESSION_TTL_SECONDS,
  })
}

export async function deleteSession(sessionId: string): Promise<void> {
  const client = await getRedisClient()
  await client.del(getSessionKey(sessionId))
}

function getNonceKey(accountId: string, nonceBase64: string): string {
  return `self-nonce:${accountId}:${nonceBase64}`
}

export async function reserveSignatureNonce(
  accountId: string,
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
