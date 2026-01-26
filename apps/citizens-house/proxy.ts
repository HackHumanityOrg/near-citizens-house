import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { get } from "@vercel/edge-config"

// Routes that should remain accessible during maintenance
const EXEMPT_PATHS = ["/privacy", "/terms", "/maintenance"]
const EXEMPT_PREFIXES = ["/_next", "/api", "/ingest"]
const STATIC_EXTENSIONS = [".ico", ".png", ".jpg", ".jpeg", ".svg", ".webp", ".gif", ".css", ".js", ".woff", ".woff2"]

const MAINTENANCE_KEY = "maintenance"
const PREVIEW_MAINTENANCE_PREFIX = "maintenance_preview_"
const PREVIEW_MAINTENANCE_FALLBACK = "maintenance_preview"
const MAX_EDGE_CONFIG_KEY_LENGTH = 256

function sanitizeKeySegment(value: string): { value: string; changed: boolean } {
  const sanitized = value.replace(/[^A-Za-z0-9_-]+/g, "_")
  return { value: sanitized, changed: sanitized !== value }
}

function hashKeySegment(value: string): string {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(16).padStart(8, "0")
}

function buildPreviewKey(branch?: string): string {
  if (!branch) {
    return PREVIEW_MAINTENANCE_FALLBACK
  }

  const { value, changed } = sanitizeKeySegment(branch)
  let key = `${PREVIEW_MAINTENANCE_PREFIX}${value}`

  if (changed) {
    key = `${key}_${hashKeySegment(branch)}`
  }

  if (key.length > MAX_EDGE_CONFIG_KEY_LENGTH) {
    const hash = hashKeySegment(branch)
    const available = MAX_EDGE_CONFIG_KEY_LENGTH - PREVIEW_MAINTENANCE_PREFIX.length - 1 - hash.length
    const trimmed = value.slice(0, Math.max(0, available))
    key = `${PREVIEW_MAINTENANCE_PREFIX}${trimmed}_${hash}`
  }

  return key
}

function getMaintenanceKey(): string {
  if (process.env.VERCEL_ENV === "preview") {
    return buildPreviewKey(process.env.VERCEL_GIT_COMMIT_REF)
  }

  return MAINTENANCE_KEY
}

function isExemptPath(pathname: string): boolean {
  if (EXEMPT_PATHS.includes(pathname)) {
    return true
  }

  for (const prefix of EXEMPT_PREFIXES) {
    if (pathname.startsWith(prefix)) {
      return true
    }
  }

  for (const ext of STATIC_EXTENSIONS) {
    if (pathname.endsWith(ext)) {
      return true
    }
  }

  return false
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (isExemptPath(pathname)) {
    return NextResponse.next()
  }

  try {
    const maintenance = await get(getMaintenanceKey())

    if (maintenance === true || maintenance === "true") {
      request.nextUrl.pathname = "/maintenance"
      return NextResponse.rewrite(request.nextUrl)
    }
  } catch {
    // Edge Config read failed - continue without maintenance mode
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
