import { sha256 } from "@noble/hashes/sha2"
import { ed25519 } from "@noble/curves/ed25519"
import { baseEncode } from "@near-js/utils"
import { KeyPairEd25519 } from "@near-js/crypto"

/**
 * Derives a deterministic ed25519 key pair from a seed and worker index.
 *
 * This allows parallel Playwright workers to each have their own NEAR access key
 * with independent nonce sequences, eliminating nonce collision issues.
 *
 * The derivation is deterministic: same seed + index = same key every time.
 * Keys are reusable across test runs.
 *
 * @param seed - The seed string (typically NEAR_PRIVATE_KEY)
 * @param workerIndex - The Playwright worker index (0 to workers-1)
 * @returns A KeyPairEd25519 instance
 */
export function deriveWorkerKey(seed: string, workerIndex: number): KeyPairEd25519 {
  // Deterministic: same seed + index = same key every time
  const input = `${seed}:e2e-worker:${workerIndex}`
  const secretKey = sha256(new TextEncoder().encode(input)) // 32 bytes

  // Replicate KeyPairEd25519.fromRandom() logic with deterministic seed
  // See: https://github.com/near/near-api-js/blob/master/packages/crypto/src/key_pair_ed25519.ts
  const publicKey = ed25519.getPublicKey(new Uint8Array(secretKey))
  const extendedSecretKey = new Uint8Array([...secretKey, ...publicKey])

  return new KeyPairEd25519(baseEncode(extendedSecretKey))
}
