import { sha256 } from "@noble/hashes/sha2.js"
import { ed25519 } from "@noble/curves/ed25519.js"
import { baseEncode } from "@near-js/utils"
import { KeyPairEd25519 } from "@near-js/crypto"
import { nearAccountIdSchema } from "../../lib/schemas/near"

export interface VoterDerivationSpec {
  namespace: "deterministic-voter"
  formula: string
  seedSource: "NEAR_PRIVATE_KEY"
}

export interface DeterministicVoterRecord {
  index: number
  accountId: string
  publicKey: string
  verified: boolean
  createTxHash: string | null
  verifyTxHash: string | null
  status: string
  error: string | null
}

export interface DeterministicVoterManifest {
  version: 1
  network: "mainnet" | "testnet"
  parentAccountId: string
  verificationContractId: string
  derivation: VoterDerivationSpec
  naming: {
    prefix: string
    pad: number
    startIndex: number
    count: number
  }
  createdAt: string
  accounts: DeterministicVoterRecord[]
}

export function deriveDeterministicVoterKey(seed: string, index: number): KeyPairEd25519 {
  const input = `${seed}:deterministic-voter:${index}`
  const secretKey = sha256(new TextEncoder().encode(input))
  const publicKey = ed25519.getPublicKey(new Uint8Array(secretKey))
  const extendedSecretKey = new Uint8Array([...secretKey, ...publicKey])

  return new KeyPairEd25519(baseEncode(extendedSecretKey))
}

export function deriveDeterministicVoterPublicKey(seed: string, index: number): string {
  return deriveDeterministicVoterKey(seed, index).getPublicKey().toString()
}

export function buildDeterministicVoterAccountId(parent: string, prefix: string, index: number, pad: number): string {
  const safePad = Number.isFinite(pad) && pad > 0 ? Math.floor(pad) : 4
  const id = `${prefix}-${index.toString().padStart(safePad, "0")}.${parent}`
  const parsed = nearAccountIdSchema.safeParse(id)
  if (!parsed.success) {
    throw new Error(`Generated invalid NEAR account ID: ${id}`)
  }
  return parsed.data
}

export function upsertManifestRecord(
  records: DeterministicVoterRecord[],
  next: DeterministicVoterRecord,
): DeterministicVoterRecord[] {
  const rest = records.filter((record) => record.index !== next.index)
  return [...rest, next].sort((a, b) => a.index - b.index)
}

export function ensureManifestRecordMatchesDerived(
  record: DeterministicVoterRecord,
  derivedAccountId: string,
  derivedPublicKey: string,
): void {
  if (record.accountId !== derivedAccountId) {
    throw new Error(
      `Manifest/account mismatch for index ${record.index}: expected ${derivedAccountId}, found ${record.accountId}`,
    )
  }

  if (record.publicKey !== derivedPublicKey) {
    throw new Error(
      `Manifest/public key mismatch for index ${record.index}: expected ${derivedPublicKey}, found ${record.publicKey}`,
    )
  }
}

export function buildDerivationSpec(): VoterDerivationSpec {
  return {
    namespace: "deterministic-voter",
    formula: "sha256(`${NEAR_PRIVATE_KEY}:deterministic-voter:${index}`)",
    seedSource: "NEAR_PRIVATE_KEY",
  }
}
