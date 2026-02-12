import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { maintenanceMode, appMode } from "./flags"

const EXEMPT_PATHS = ["/privacy", "/terms"]
const EXEMPT_PREFIXES = ["/_next", "/api", "/ingest", "/.well-known"]
const STATIC_EXTENSIONS = [".ico", ".png", ".jpg", ".jpeg", ".svg", ".webp", ".gif", ".css", ".js", ".woff", ".woff2"]

const STAGE_HOME = {
  verification: "/verification",
  waiting: "/waiting",
  voting: "/governance",
} as const

type AppStage = keyof typeof STAGE_HOME

function redirectTo(request: NextRequest, pathname: string): NextResponse {
  const url = request.nextUrl.clone()
  url.pathname = pathname
  return NextResponse.redirect(url)
}

function isAllowedStagePath(mode: AppStage, pathname: string): boolean {
  if (mode === "waiting") {
    return pathname === "/waiting" || pathname === "/citizens"
  }

  const stageHome = STAGE_HOME[mode]
  return pathname === stageHome || pathname.startsWith(`${stageHome}/`)
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
      if (pathname === "/maintenance") {
        return NextResponse.next()
      }

      return redirectTo(request, "/maintenance")
    }

    const mode = await appMode()
    const stageHome = STAGE_HOME[mode]

    if (pathname === "/" || pathname === "/maintenance") {
      return redirectTo(request, stageHome)
    }

    if (!isAllowedStagePath(mode, pathname)) {
      return redirectTo(request, stageHome)
    }
  } catch {
    return redirectTo(request, "/maintenance")
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
