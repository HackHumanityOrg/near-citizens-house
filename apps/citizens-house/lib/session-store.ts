// Redis-backed session store for tracking verification status
// Sessions are stored with automatic TTL expiration

import "server-only"

import { getRedisClient } from "./redis"
import { logger, LogScope, Op, type LogOperation } from "./logger"

type SessionStatus = "pending" | "success" | "error"

interface Session {
  status: SessionStatus
  accountId?: string
  attestationId?: string
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

function logSessionError(
  message: string,
  operation: LogOperation,
  sessionId: string,
  error: unknown,
  extra: Record<string, unknown> = {},
): void {
  const errorDetails =
    error instanceof Error
      ? {
          error_type: error.name,
          error_message: error.message,
          error_stack: error.stack,
        }
      : { error_message: String(error) }

  logger.error(message, {
    scope: LogScope.VERIFICATION,
    operation,
    session_id: sessionId,
    ...extra,
    ...errorDetails,
  })
}

export async function createSession(sessionId: string): Promise<void> {
  try {
    const client = await getRedisClient()
    const session: Session = {
      status: "pending",
      timestamp: Date.now(),
    }
    await client.set(getSessionKey(sessionId), JSON.stringify(session), {
      EX: SESSION_TTL_SECONDS,
    })
    logger.info("Session created", {
      scope: LogScope.VERIFICATION,
      operation: Op.VERIFICATION.SESSION_CREATE,
      session_id: sessionId,
      status: session.status,
    })
  } catch (error) {
    logSessionError("Failed to create session", Op.VERIFICATION.SESSION_CREATE, sessionId, error)
    throw error
  }
}

export async function getSession(sessionId: string): Promise<Session | null> {
  try {
    const client = await getRedisClient()
    const data = await client.get(getSessionKey(sessionId))
    if (!data) return null
    return JSON.parse(data) as Session
  } catch (error) {
    logSessionError("Failed to fetch session", Op.VERIFICATION.SESSION_GET, sessionId, error)
    throw error
  }
}

export async function updateSession(
  sessionId: string,
  update: { status: SessionStatus; accountId?: string; attestationId?: string; error?: string; errorCode?: string },
): Promise<void> {
  try {
    const client = await getRedisClient()
    const key = getSessionKey(sessionId)
    const existing = await client.get(key)

    const session: Session = existing
      ? { ...JSON.parse(existing), ...update, timestamp: Date.now() }
      : {
          status: update.status,
          accountId: update.accountId,
          attestationId: update.attestationId,
          error: update.error,
          errorCode: update.errorCode,
          timestamp: Date.now(),
        }

    await client.set(key, JSON.stringify(session), {
      EX: SESSION_TTL_SECONDS,
    })

    logger.info("Session updated", {
      scope: LogScope.VERIFICATION,
      operation: Op.VERIFICATION.SESSION_UPDATE,
      session_id: sessionId,
      status: session.status,
      account_id: session.accountId,
      attestation_id: session.attestationId,
      error_code: session.errorCode,
    })
  } catch (error) {
    logSessionError("Failed to update session", Op.VERIFICATION.SESSION_UPDATE, sessionId, error, {
      status: update.status,
      account_id: update.accountId,
      attestation_id: update.attestationId,
      error_code: update.errorCode,
    })
    throw error
  }
}

export async function deleteSession(sessionId: string): Promise<void> {
  try {
    const client = await getRedisClient()
    await client.del(getSessionKey(sessionId))
    logger.info("Session deleted", {
      scope: LogScope.VERIFICATION,
      operation: Op.VERIFICATION.SESSION_DELETE,
      session_id: sessionId,
    })
  } catch (error) {
    logSessionError("Failed to delete session", Op.VERIFICATION.SESSION_DELETE, sessionId, error)
    throw error
  }
}

function getNonceKey(accountId: string, nonceBase64: string): string {
  return `self-nonce:${accountId}:${nonceBase64}`
}

export async function reserveSignatureNonce(
  accountId: string,
  nonceBase64: string,
  ttlSeconds: number = NONCE_TTL_SECONDS,
): Promise<boolean> {
  try {
    const client = await getRedisClient()
    const key = getNonceKey(accountId, nonceBase64)
    const result = await client.set(key, "1", {
      EX: ttlSeconds,
      NX: true,
    })
    return result === "OK"
  } catch (error) {
    const errorDetails =
      error instanceof Error
        ? {
            error_type: error.name,
            error_message: error.message,
            error_stack: error.stack,
          }
        : { error_message: String(error) }

    logger.error("Failed to reserve signature nonce", {
      scope: LogScope.VERIFICATION,
      operation: Op.VERIFICATION.NONCE_RESERVE,
      account_id: accountId,
      nonce_base64: nonceBase64,
      ttl_seconds: ttlSeconds,
      ...errorDetails,
    })
    throw error
  }
}
