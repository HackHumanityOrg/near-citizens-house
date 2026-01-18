/**
 * Helper functions for wide event logging
 *
 * Provides extraction of PostHog identifiers and platform detection
 * from incoming requests.
 */

import type { NextRequest } from "next/server"
import type { Platform } from "./types"

// PostHog cookie names (auto-set by PostHog SDK)
const POSTHOG_DISTINCT_ID_COOKIE = "ph_phc_"
const POSTHOG_SESSION_ID_SUFFIX = "_posthog"

/**
 * Extract PostHog distinct ID from request cookies
 *
 * PostHog SDK sets cookies like `ph_phc_<project_id>_posthog` with JSON
 * containing `distinct_id`. Falls back to null if not found.
 */
export function extractDistinctId(request: NextRequest): string | null {
  try {
    // PostHog cookies are named like: ph_phc_<project_id>_posthog
    for (const [name, cookie] of request.cookies) {
      if (name.startsWith(POSTHOG_DISTINCT_ID_COOKIE) && name.endsWith(POSTHOG_SESSION_ID_SUFFIX)) {
        const value = cookie.value
        if (value) {
          const parsed = JSON.parse(decodeURIComponent(value))
          if (parsed && typeof parsed.distinct_id === "string") {
            return parsed.distinct_id
          }
        }
      }
    }
    return null
  } catch {
    return null
  }
}

/**
 * Extract PostHog session ID from request cookies
 *
 * PostHog SDK includes `$sesid` in the same cookie as distinct_id.
 * The session ID is the second element of the array.
 */
export function extractSessionId(request: NextRequest): string | null {
  try {
    for (const [name, cookie] of request.cookies) {
      if (name.startsWith(POSTHOG_DISTINCT_ID_COOKIE) && name.endsWith(POSTHOG_SESSION_ID_SUFFIX)) {
        const value = cookie.value
        if (value) {
          const parsed = JSON.parse(decodeURIComponent(value))
          // PostHog stores session as: $sesid: [timestamp, sessionId, ...]
          if (parsed && Array.isArray(parsed.$sesid) && typeof parsed.$sesid[1] === "string") {
            return parsed.$sesid[1]
          }
        }
      }
    }
    return null
  } catch {
    return null
  }
}

/**
 * Detect platform from User-Agent header
 *
 * Simple heuristic to categorize as mobile, desktop, or unknown.
 */
export function extractPlatform(userAgent: string | null): Platform {
  if (!userAgent) return "unknown"

  const ua = userAgent.toLowerCase()

  // Mobile detection patterns
  const mobilePatterns = [
    "mobile",
    "android",
    "iphone",
    "ipad",
    "ipod",
    "blackberry",
    "windows phone",
    "opera mini",
    "opera mobi",
    "iemobile",
    "silk",
    "kindle",
  ]

  for (const pattern of mobilePatterns) {
    if (ua.includes(pattern)) {
      return "mobile"
    }
  }

  // If it has common desktop browser identifiers and no mobile indicators
  const desktopPatterns = ["mozilla", "chrome", "safari", "firefox", "edge", "opera", "msie", "trident"]

  for (const pattern of desktopPatterns) {
    if (ua.includes(pattern)) {
      return "desktop"
    }
  }

  return "unknown"
}

/**
 * Set a nested property on an object using dot notation
 *
 * Example: setNestedProperty(obj, "error.code", "INVALID") sets obj.error.code = "INVALID"
 */
export function setNestedProperty(obj: Record<string, unknown>, path: string, value: unknown): void {
  const keys = path.split(".")
  let current: Record<string, unknown> = obj

  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i]
    if (!(key in current) || typeof current[key] !== "object" || current[key] === null) {
      current[key] = {}
    }
    current = current[key] as Record<string, unknown>
  }

  current[keys[keys.length - 1]] = value
}

/**
 * Get a nested property from an object using dot notation
 */
export function getNestedProperty(obj: Record<string, unknown>, path: string): unknown {
  const keys = path.split(".")
  let current: unknown = obj

  for (const key of keys) {
    if (current === null || current === undefined || typeof current !== "object") {
      return undefined
    }
    current = (current as Record<string, unknown>)[key]
  }

  return current
}
