import { NextResponse } from "next/server"

const FALLBACK_MANIFEST = { wallets: [], version: "1.0.0" }
const SOURCE_MANIFEST_URLS = [
  "https://raw.githubusercontent.com/hot-dao/near-selector/refs/heads/main/repository/manifest.json",
  "https://cdn.jsdelivr.net/gh/azbang/hot-connector/repository/manifest.json",
]
const MANIFEST_REVALIDATE_SECONDS = 300
const MANIFEST_TAG = "near-wallet-manifest"

type ManifestPayload = {
  wallets: unknown[]
  version: string
}

let manifestCache: ManifestPayload | null = null

function isManifestPayload(candidate: unknown): candidate is ManifestPayload {
  if (!candidate || typeof candidate !== "object") return false
  return (
    "version" in candidate &&
    typeof candidate.version === "string" &&
    "wallets" in candidate &&
    Array.isArray(candidate.wallets)
  )
}

async function fetchManifestFromRemote(url: string): Promise<ManifestPayload | null> {
  try {
    const response = await fetch(url, {
      cache: "force-cache",
      next: {
        revalidate: MANIFEST_REVALIDATE_SECONDS,
        tags: [MANIFEST_TAG],
      },
    })
    if (!response.ok) return null
    const payload = (await response.json()) as unknown
    return isManifestPayload(payload) ? payload : null
  } catch {
    return null
  }
}

async function resolveManifest(): Promise<ManifestPayload> {
  for (const url of SOURCE_MANIFEST_URLS) {
    const manifest = await fetchManifestFromRemote(url)
    if (manifest) {
      manifestCache = manifest
      return manifest
    }
  }

  return manifestCache ?? FALLBACK_MANIFEST
}

export async function GET() {
  const manifest = await resolveManifest()
  return NextResponse.json(manifest)
}
