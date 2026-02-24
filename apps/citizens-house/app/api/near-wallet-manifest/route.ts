import { NextResponse } from "next/server"

const FALLBACK_MANIFEST = { wallets: [], version: "1.0.0" }
const SOURCE_MANIFEST_URLS = [
  "https://raw.githubusercontent.com/hot-dao/near-selector/refs/heads/main/repository/manifest.json",
  "https://cdn.jsdelivr.net/gh/azbang/hot-connector/repository/manifest.json",
]
const MANIFEST_FETCH_TIMEOUT_MS = 5_000
const MANIFEST_REVALIDATE_SECONDS = 300
const MANIFEST_TAG = "near-wallet-manifest"
const CACHE_CONTROL_HEADER = `public, max-age=${MANIFEST_REVALIDATE_SECONDS}, s-maxage=${MANIFEST_REVALIDATE_SECONDS}, stale-while-revalidate=${MANIFEST_REVALIDATE_SECONDS}`
const MANIFEST_REVALIDATE_MS = MANIFEST_REVALIDATE_SECONDS * 1_000

type ManifestPayload = {
  wallets: unknown[]
  version: string
}

let manifestCache: ManifestPayload | null = null
let manifestCacheUpdatedAt = 0
let manifestFetchPromise: Promise<ManifestPayload | null> | null = null

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
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), MANIFEST_FETCH_TIMEOUT_MS)
  try {
    const response = await fetch(url, {
      signal: controller.signal,
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
  } finally {
    clearTimeout(timeout)
  }
}

function getManifestFetchPromise(): Promise<ManifestPayload | null> {
  if (!manifestFetchPromise) {
    manifestFetchPromise = Promise.any(
      SOURCE_MANIFEST_URLS.map(async (url) => {
        const manifest = await fetchManifestFromRemote(url)
        if (!manifest) throw new Error("Invalid manifest response")
        return manifest
      }),
    )
      .then((manifest) => {
        manifestCache = manifest
        manifestCacheUpdatedAt = Date.now()
        return manifest
      })
      .catch(() => null)
      .finally(() => {
        manifestFetchPromise = null
      })
  }

  return manifestFetchPromise
}

async function resolveManifest(): Promise<ManifestPayload | null> {
  if (manifestCache) {
    const cacheAgeMs = Date.now() - manifestCacheUpdatedAt
    const isStale = cacheAgeMs >= MANIFEST_REVALIDATE_MS

    // Return stale data immediately and refresh in the background.
    if (isStale) {
      void getManifestFetchPromise()
    }

    return manifestCache
  }

  const manifest = await getManifestFetchPromise()

  return manifest ?? null
}

export async function GET() {
  const manifest = await resolveManifest()

  if (!manifest) {
    return NextResponse.json(FALLBACK_MANIFEST, {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    })
  }

  return NextResponse.json(manifest, {
    headers: { "Cache-Control": CACHE_CONTROL_HEADER },
  })
}
