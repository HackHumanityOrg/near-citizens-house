/**
 * Shared RPC provider setup for scripts.
 *
 * Mirrors the header configuration from lib/providers/rpc-provider.ts
 * without the "server-only" guard (which is incompatible with tsx scripts).
 *
 * Adds rate-limit-aware retry: FastNEAR returns -429 as a JSON-RPC error
 * inside an HTTP 200 response, so @near-js/providers' built-in retry
 * (which only handles HTTP 500/503/408) never triggers for rate limits.
 */
import { JsonRpcProvider } from "@near-js/providers"
import { getFastNearRpcUrl, type NearNetwork } from "../../lib/rpc-endpoints"

export function getDefaultRpcUrl(network: NearNetwork): string {
  return getFastNearRpcUrl(network)
}

export function getRpcHeaders(): Record<string, string> {
  const headers: Record<string, string> = {}
  if (process.env.FASTNEAR_API_KEY) {
    headers["X-API-Key"] = process.env.FASTNEAR_API_KEY
  }
  return headers
}

export function createScriptRpcProvider(rpcUrl: string): JsonRpcProvider {
  return new JsonRpcProvider({ url: rpcUrl, headers: getRpcHeaders() })
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function isRateLimitError(error: unknown): boolean {
  if (error instanceof Error) {
    return error.message.includes("-429") || error.message.includes("Rate limit")
  }
  return false
}

/**
 * Re-throw rate limit errors so they propagate to withRateLimitRetry.
 * Use in catch blocks that return default values (e.g. `catch { return false }`).
 */
export function rethrowIfRateLimit(error: unknown): void {
  if (isRateLimitError(error)) throw error
}

/**
 * Retry an async operation with exponential backoff on rate limit errors.
 * Non-rate-limit errors are thrown immediately.
 */
export async function withRateLimitRetry<T>(fn: () => Promise<T>, maxRetries = 5, initialDelayMs = 2000): Promise<T> {
  let delay = initialDelayMs
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      if (!isRateLimitError(error) || attempt === maxRetries) {
        throw error
      }
      await sleep(delay)
      delay = Math.min(delay * 2, 30000)
    }
  }
  throw new Error("Unreachable")
}
