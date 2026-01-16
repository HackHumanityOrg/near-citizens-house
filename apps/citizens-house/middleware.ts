import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { get } from "@vercel/edge-config"

// Routes that should remain accessible during maintenance
const EXEMPT_PATHS = ["/privacy", "/terms", "/maintenance"]
const EXEMPT_PREFIXES = ["/_next", "/api", "/ingest"]
const STATIC_EXTENSIONS = [".ico", ".png", ".jpg", ".jpeg", ".svg", ".webp", ".gif", ".css", ".js", ".woff", ".woff2"]

/**
 * Check if maintenance mode is enabled via Vercel Edge Config.
 * Edge Config provides sub-millisecond reads globally.
 */
async function checkMaintenanceMode(): Promise<boolean> {
  try {
    const maintenance = await get<boolean>("maintenance")
    return maintenance === true
  } catch (error) {
    console.error("[Middleware] Error reading Edge Config:", error)
    return false // Fail open
  }
}

/**
 * Check if a path should be exempt from maintenance redirect
 */
function isExemptPath(pathname: string): boolean {
  // Check exact paths
  if (EXEMPT_PATHS.includes(pathname)) {
    return true
  }

  // Check path prefixes
  for (const prefix of EXEMPT_PREFIXES) {
    if (pathname.startsWith(prefix)) {
      return true
    }
  }

  // Check static file extensions
  for (const ext of STATIC_EXTENSIONS) {
    if (pathname.endsWith(ext)) {
      return true
    }
  }

  return false
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Skip middleware for exempt paths
  if (isExemptPath(pathname)) {
    return NextResponse.next()
  }

  // Check if maintenance mode is enabled
  const isPaused = await checkMaintenanceMode()

  if (isPaused) {
    // Redirect to maintenance page
    const maintenanceUrl = new URL("/maintenance", request.url)
    return NextResponse.redirect(maintenanceUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
}
