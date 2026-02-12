import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { maintenanceMode, appMode } from "./flags"

const EXEMPT_PATHS = ["/privacy", "/terms", "/maintenance", "/waiting"]
const EXEMPT_PREFIXES = ["/_next", "/api", "/ingest", "/.well-known"]
const STATIC_EXTENSIONS = [".ico", ".png", ".jpg", ".jpeg", ".svg", ".webp", ".gif", ".css", ".js", ".woff", ".woff2"]

function redirectTo(request: NextRequest, pathname: string): NextResponse {
  const url = request.nextUrl.clone()
  url.pathname = pathname
  return NextResponse.redirect(url)
}

function isExemptPath(pathname: string): boolean {
  if (EXEMPT_PATHS.includes(pathname)) return true
  for (const prefix of EXEMPT_PREFIXES) {
    if (pathname.startsWith(prefix)) return true
  }
  for (const ext of STATIC_EXTENSIONS) {
    if (pathname.endsWith(ext)) return true
  }
  return false
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (isExemptPath(pathname)) {
    return NextResponse.next()
  }

  try {
    const maintenance = await maintenanceMode()
    if (maintenance) {
      return redirectTo(request, "/maintenance")
    }

    const mode = await appMode()

    if (mode === "waiting" && pathname !== "/citizens") {
      return redirectTo(request, "/waiting")
    }

    if (mode === "verification" && pathname.startsWith("/governance")) {
      return redirectTo(request, "/verification")
    }

    if (mode === "voting" && pathname.startsWith("/verification")) {
      return redirectTo(request, "/governance")
    }

    if (pathname === "/") {
      if (mode === "waiting") {
        return redirectTo(request, "/waiting")
      }

      return redirectTo(request, mode === "voting" ? "/governance" : "/verification")
    }
  } catch {
    return redirectTo(request, "/maintenance")
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
