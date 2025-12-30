// Redis-backed session store for tracking verification status
// Sessions are stored with automatic TTL expiration

import { createClient, type RedisClientType } from "redis"

type SessionStatus = "pending" | "success" | "error"

interface Session {
  status: SessionStatus
  accountId?: string
  error?: string
  timestamp: number
}

// Session expiration time (5 minutes)
const SESSION_TTL_SECONDS = 5 * 60

let redis: RedisClientType | null = null

async function getRedisClient(): Promise<RedisClientType> {
  if (!redis) {
    const redisUrl = process.env.REDIS_URL
    if (!redisUrl) {
      throw new Error("REDIS_URL environment variable is not set")
    }

    redis = createClient({
      url: redisUrl,
    })
    redis.on("error", (err) => console.error("[Redis] Client Error:", err))
    await redis.connect()
    console.log("[Redis] Connected successfully")
  }
  return redis
}

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
  update: { status: SessionStatus; accountId?: string; error?: string },
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
