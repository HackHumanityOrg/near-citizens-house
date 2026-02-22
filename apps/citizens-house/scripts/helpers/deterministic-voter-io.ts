import * as fs from "fs"
import * as path from "path"
import type { DeterministicVoterManifest, DeterministicVoterRecord } from "./deterministic-voter-keys"

export interface DeterministicVoteRunRecord {
  index: number
  accountId: string
  publicKey: string
  status: "voted" | "already_voted" | "skipped_unverified" | "failed" | "skipped_dry_run"
  relayTxHash: string | null
  relayReason: string | null
  error: string | null
}

export interface DeterministicVoteRunReport {
  version: 1
  network: "mainnet" | "testnet"
  governanceContractId: string
  relayUrl: string
  proposalId: number
  choice: "yes" | "no"
  mode: "gasless-relay"
  execution: "sequential"
  startedAt: string
  endedAt: string | null
  results: DeterministicVoteRunRecord[]
}

export function resolveDefaultManifestPath(network: "mainnet" | "testnet"): string {
  return path.resolve(process.cwd(), "apps/citizens-house/scripts/fixtures", `deterministic-voters.${network}.json`)
}

export function resolveDefaultVoteRunPath(proposalId: number): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
  return path.resolve(
    process.cwd(),
    "apps/citizens-house/scripts/fixtures/vote-runs",
    `${timestamp}-proposal-${proposalId}.json`,
  )
}

export function ensureDirForFile(filePath: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
}

export function writeJsonFile(filePath: string, value: unknown): void {
  ensureDirForFile(filePath)
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf-8")
}

export function readManifest(filePath: string): DeterministicVoterManifest | null {
  if (!fs.existsSync(filePath)) {
    return null
  }

  const raw = fs.readFileSync(filePath, "utf-8")
  const parsed: unknown = JSON.parse(raw)
  if (!isManifest(parsed)) {
    throw new Error(`Invalid manifest format: ${filePath}`)
  }

  return parsed
}

export function isManifest(value: unknown): value is DeterministicVoterManifest {
  if (!isRecord(value)) return false
  if (value.version !== 1) return false
  if (value.network !== "mainnet" && value.network !== "testnet") return false
  if (typeof value.parentAccountId !== "string") return false
  if (typeof value.verificationContractId !== "string") return false
  if (!isRecord(value.derivation) || value.derivation.namespace !== "deterministic-voter") return false
  if (!isRecord(value.naming)) return false
  if (!Array.isArray(value.accounts)) return false

  return value.accounts.every(isManifestRecord)
}

export function isManifestRecord(value: unknown): value is DeterministicVoterRecord {
  if (!isRecord(value)) return false
  if ("privateKey" in value || "secretKey" in value) return false
  return (
    typeof value.index === "number" &&
    typeof value.accountId === "string" &&
    typeof value.publicKey === "string" &&
    typeof value.verified === "boolean" &&
    (typeof value.createTxHash === "string" || value.createTxHash === null) &&
    (typeof value.verifyTxHash === "string" || value.verifyTxHash === null) &&
    typeof value.status === "string" &&
    (typeof value.error === "string" || value.error === null)
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}
