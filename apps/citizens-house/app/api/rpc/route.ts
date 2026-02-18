import { type NextRequest, NextResponse } from "next/server"
import { NEAR_SERVER_CONFIG } from "@/lib/config.server"

const FASTNEAR_RPC_BY_NETWORK = {
  mainnet: "https://rpc.mainnet.fastnear.com",
  testnet: "https://rpc.testnet.fastnear.com",
} as const

type NetworkId = keyof typeof FASTNEAR_RPC_BY_NETWORK

function resolveNetwork(value: string | null): NetworkId | null {
  if (value === "mainnet" || value === "testnet") return value
  return null
}

function getCorsHeaders(request: NextRequest): HeadersInit {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": request.headers.get("access-control-request-headers") ?? "content-type",
  }
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { status: 204, headers: getCorsHeaders(request) })
}

export async function POST(request: NextRequest) {
  const corsHeaders = getCorsHeaders(request)
  const network = resolveNetwork(request.nextUrl.searchParams.get("network")) ?? NEAR_SERVER_CONFIG.networkId
  const rpcUrl = FASTNEAR_RPC_BY_NETWORK[network]
  const apiKey = NEAR_SERVER_CONFIG.rpcApiKey.trim()

  if (!apiKey) {
    return NextResponse.json(
      { error: "FASTNEAR_API_KEY is not configured on the server" },
      { status: 500, headers: corsHeaders },
    )
  }

  try {
    const body = await request.text()
    const upstreamResponse = await fetch(rpcUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": apiKey,
      },
      body,
      cache: "no-store",
    })

    const responseBody = await upstreamResponse.text()
    const contentType = upstreamResponse.headers.get("content-type") ?? "application/json"

    return new NextResponse(responseBody, {
      status: upstreamResponse.status,
      headers: {
        ...corsHeaders,
        "Content-Type": contentType,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: `RPC proxy failed: ${message}` }, { status: 502, headers: corsHeaders })
  }
}
