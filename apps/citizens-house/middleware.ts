import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { get } from "@vercel/edge-config"

// Routes that should remain accessible during maintenance
const EXEMPT_PATHS = ["/privacy", "/terms", "/maintenance"]
const EXEMPT_PREFIXES = ["/_next", "/api", "/ingest"]
const STATIC_EXTENSIONS = [".ico", ".png", ".jpg", ".jpeg", ".svg", ".webp", ".gif", ".css", ".js", ".woff", ".woff2"]

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

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (isExemptPath(pathname)) {
    return NextResponse.next()
  }

  try {
    const maintenance = await get("maintenance")

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
