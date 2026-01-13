import { sha256 } from "@noble/hashes/sha2.js"
import { ed25519 } from "@noble/curves/ed25519.js"
import { baseEncode } from "@near-js/utils"
import { KeyPairEd25519 } from "@near-js/crypto"

/**
 * Derives a deterministic ed25519 key pair from a seed and worker index.
 *
 * This allows parallel Playwright workers to each have their own NEAR access key
 * with independent nonce sequences, eliminating nonce collision issues.
 *
 * The derivation is deterministic: same seed + index (+ optional E2E_RUN_ID) = same key every time.
 * Keys are reusable across test runs.
 *
 * @param seed - The seed string (typically NEAR_PRIVATE_KEY)
 * @param workerIndex - The Playwright worker index (0 to workers-1)
 * @returns A KeyPairEd25519 instance
 */
function normalizeRunId(runId: string): string | null {
  const normalized = runId
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")

  return normalized.length > 0 ? normalized : null
}

export function getRunIdTag(): string | null {
  const runId = process.env.E2E_RUN_ID?.trim()
  if (!runId) {
    return null
  }

  const normalized = normalizeRunId(runId)
  if (!normalized) {
    return null
  }

  return normalized.slice(0, 20)
}

export function deriveWorkerKey(seed: string, workerIndex: number): KeyPairEd25519 {
  // Deterministic: same seed + index = same key every time
  const runIdTag = getRunIdTag()
  const input = runIdTag ? `${seed}:e2e-worker:${workerIndex}:${runIdTag}` : `${seed}:e2e-worker:${workerIndex}`
  const secretKey = sha256(new TextEncoder().encode(input)) // 32 bytes

  // Replicate KeyPairEd25519.fromRandom() logic with deterministic seed
  // See: https://github.com/near/near-api-js/blob/master/packages/crypto/src/key_pair_ed25519.ts
  const publicKey = ed25519.getPublicKey(new Uint8Array(secretKey))
  const extendedSecretKey = new Uint8Array([...secretKey, ...publicKey])

  return new KeyPairEd25519(baseEncode(extendedSecretKey))
}
