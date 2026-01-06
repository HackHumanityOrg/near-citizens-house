/**
 * Shared Redis client singleton
 *
 * This module provides a single Redis connection that can be shared
 * across the application to avoid creating multiple connections.
 *
 * Uses a promise-based singleton pattern to prevent race conditions
 * during concurrent initialization. Resets the promise on connection
 * failure to allow recovery after transient errors.
 */

import { createClient } from "redis"

// Type for the Redis client returned by createClient
type RedisClient = ReturnType<typeof createClient>

let connectionPromise: Promise<RedisClient> | null = null

/**
 * Get the shared Redis client, creating a connection if necessary.
 * Uses a promise-based singleton pattern to ensure only one connection
 * per server instance, even under concurrent access during startup.
 *
 * If connection fails, the promise is reset so subsequent calls can retry.
 *
 * @throws Error if REDIS_URL environment variable is not set
 */
export async function getRedisClient(): Promise<RedisClient> {
  if (!connectionPromise) {
    connectionPromise = (async () => {
      const redisUrl = process.env.REDIS_URL
      if (!redisUrl) {
        throw new Error("REDIS_URL environment variable is not set")
      }

      const client = createClient({
        url: redisUrl,
      })
      client.on("error", (err) => console.error("[Redis] Client Error:", err))

      try {
        await client.connect()
        console.log("[Redis] Connected successfully")
        return client
      } catch (err) {
        // Reset the promise so subsequent calls can retry
        connectionPromise = null
        throw err
      }
    })()
  }
  return connectionPromise
}
