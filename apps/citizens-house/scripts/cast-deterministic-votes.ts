#!/usr/bin/env npx tsx
/**
 * Cast deterministic votes via gasless relay using manifest-backed voter accounts.
 *
 * Prerequisite:
 * - Run bootstrap-deterministic-voters.ts first to create and verify voters
 *   and produce the manifest consumed by this script.
 *
 * What this script does:
 * - Loads manifest entries for the requested index range
 * - Re-derives keys from NEAR_PRIVATE_KEY and verifies manifest/key consistency
 * - Preflights each voter (account exists, verified, proposal active, not already voted)
 * - Builds and signs SignedDelegate payloads for cast_vote
 * - Submits to /api/governance/relay sequentially
 * - Writes a vote-run report JSON with per-voter outcomes
 *
 * Required environment variables:
 * - NEAR_PRIVATE_KEY
 * - NEXT_PUBLIC_NEAR_VERIFICATION_CONTRACT
 * - NEXT_PUBLIC_NEAR_GOVERNANCE_CONTRACT (unless --governance-contract is passed)
 * - NEXT_PUBLIC_NEAR_NETWORK (mainnet|testnet)
 *
 * Optional environment variables:
 * - NEXT_PUBLIC_APP_URL (used to derive default --relay-url)
 * - FASTNEAR_API_KEY
 *
 * Usage:
 * - pnpm vote:deterministic -- --proposal-id 42 --choice yes --start-index 0 --count 10
 * - pnpm vote:deterministic -- --proposal-id 42 --choice no --start-index 10 --count 5 --fail-fast
 * - pnpm vote:deterministic -- --proposal-id 42 --choice yes --start-index 0 --count 10 --dry-run
 *
 * Useful flags:
 * - --manifest <path>                Custom manifest path
 * - --relay-url <url>                Override relay endpoint
 * - --report <path>                  Custom vote report path
 * - --max-block-height-window <num>  Delegate TTL window
 * - --rpc-url <url>                  Override RPC endpoint
 */

import { Account } from "@near-js/accounts"
import { KeyPairSigner } from "@near-js/signers"
import { JsonRpcProvider } from "@near-js/providers"
import { actionCreators, encodeSignedDelegate } from "@near-js/transactions"
import { GAS_100_TGAS_BIGINT } from "../lib/contracts/gas"
import { contractProposalViewSchema, voteChoiceSchema } from "../lib/schemas/governance-contract"
import { contractVerificationSummarySchema } from "../lib/schemas/verification-contract"
import type { ContractProposalView } from "../lib/schemas/governance-contract"
import type { ContractVerificationSummary } from "../lib/schemas/verification-contract"
import {
  buildDeterministicVoterAccountId,
  deriveDeterministicVoterKey,
  ensureManifestRecordMatchesDerived,
} from "./helpers/deterministic-voter-keys"
import {
  readManifest,
  resolveDefaultManifestPath,
  resolveDefaultVoteRunPath,
  type DeterministicVoteRunRecord,
  type DeterministicVoteRunReport,
  writeJsonFile,
} from "./helpers/deterministic-voter-io"
import { classifyRelayResponse } from "./helpers/relay-vote-utils"
import { loadNearestEnvFile } from "./helpers/load-env"
import { createScriptRpcProvider, getDefaultRpcUrl, withRateLimitRetry } from "./helpers/rpc"

interface VoteOptions {
  proposalId: number
  choice: "yes" | "no"
  startIndex: number
  count: number
  manifestPath: string
  relayUrl: string
  governanceContractId: string
  maxBlockHeightWindow: number
  dryRun: boolean
  reportPath: string
  failFast: boolean
  rpcUrl: string
}

loadNearestEnvFile()

function parseCliArgs(argv: string[]): Record<string, string | boolean> {
  const parsed: Record<string, string | boolean> = {}

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (!arg.startsWith("--")) continue
    if (arg === "--") continue

    const key = arg.slice(2)
    const next = argv[i + 1]
    if (!next || next.startsWith("--")) {
      parsed[key] = true
      continue
    }

    parsed[key] = next
    i++
  }

  return parsed
}

function asString(value: string | boolean | undefined): string | undefined {
  return typeof value === "string" ? value : undefined
}

function parsePositiveInt(value: string | undefined, field: string): number {
  if (!value) {
    throw new Error(`Missing required --${field}`)
  }

  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`Invalid --${field}: ${value}`)
  }

  return parsed
}

function getNetwork(): "mainnet" | "testnet" {
  return process.env.NEXT_PUBLIC_NEAR_NETWORK === "mainnet" ? "mainnet" : "testnet"
}

function getDefaultRelayUrl(): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
  return new URL("/api/governance/relay", appUrl).toString()
}

function parseOptions(argv: string[]): VoteOptions {
  const raw = parseCliArgs(argv)
  const network = getNetwork()

  const proposalId = parsePositiveInt(asString(raw["proposal-id"]), "proposal-id")
  const choiceRaw = asString(raw.choice)
  if (!choiceRaw) {
    throw new Error("Missing required --choice")
  }

  const choiceResult = voteChoiceSchema.safeParse(choiceRaw)
  if (!choiceResult.success) {
    throw new Error("--choice must be yes or no")
  }

  const startIndex = parsePositiveInt(asString(raw["start-index"]), "start-index")
  const count = parsePositiveInt(asString(raw.count), "count")

  if (count <= 0) {
    throw new Error("--count must be greater than 0")
  }

  const manifestPath = asString(raw.manifest) ?? resolveDefaultManifestPath(network)

  return {
    proposalId,
    choice: choiceResult.data,
    startIndex,
    count,
    manifestPath,
    relayUrl: asString(raw["relay-url"]) ?? getDefaultRelayUrl(),
    governanceContractId:
      asString(raw["governance-contract"]) ??
      process.env.NEXT_PUBLIC_NEAR_GOVERNANCE_CONTRACT ??
      (() => {
        throw new Error("NEXT_PUBLIC_NEAR_GOVERNANCE_CONTRACT is required")
      })(),
    maxBlockHeightWindow: Number.parseInt(asString(raw["max-block-height-window"]) ?? "200", 10),
    dryRun: Boolean(raw["dry-run"]),
    reportPath: asString(raw.report) ?? resolveDefaultVoteRunPath(proposalId),
    failFast: Boolean(raw["fail-fast"]),
    rpcUrl: asString(raw["rpc-url"]) ?? getDefaultRpcUrl(network),
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function formatError(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error)
}

async function accountExists(provider: JsonRpcProvider, accountId: string): Promise<boolean> {
  try {
    await provider.query({
      request_type: "view_account",
      finality: "final",
      account_id: accountId,
    })
    return true
  } catch {
    return false
  }
}

async function getProposalStatus(
  provider: JsonRpcProvider,
  governanceContractId: string,
  proposalId: number,
): Promise<string> {
  const result = (await provider.callFunction<ContractProposalView>(governanceContractId, "get_proposal", {
    proposal_id: proposalId,
  })) as ContractProposalView | null
  if (result === null) {
    throw new Error("Proposal not found")
  }

  const parsed = contractProposalViewSchema.safeParse(result)
  if (!parsed.success) {
    throw new Error("Invalid proposal response from RPC")
  }

  return parsed.data.status
}

async function hasVoted(
  provider: JsonRpcProvider,
  governanceContractId: string,
  proposalId: number,
  accountId: string,
): Promise<boolean> {
  const result = await provider.callFunction<boolean>(governanceContractId, "has_voted", {
    proposal_id: proposalId,
    account_id: accountId,
  })
  return result ?? false
}

async function isVerified(
  provider: JsonRpcProvider,
  verificationContractId: string,
  accountId: string,
): Promise<boolean> {
  const result = (await provider.callFunction<ContractVerificationSummary>(verificationContractId, "get_verification", {
    account_id: accountId,
  })) as ContractVerificationSummary | null

  if (result === null) {
    return false
  }

  const parsed = contractVerificationSummarySchema.safeParse(result)
  return parsed.success && parsed.data.nearAccountId === accountId
}

function buildReport(options: VoteOptions, network: "mainnet" | "testnet"): DeterministicVoteRunReport {
  return {
    version: 1,
    network,
    governanceContractId: options.governanceContractId,
    relayUrl: options.relayUrl,
    proposalId: options.proposalId,
    choice: options.choice,
    mode: "gasless-relay",
    execution: "sequential",
    startedAt: new Date().toISOString(),
    endedAt: null,
    results: [],
  }
}

function upsertResult(
  results: DeterministicVoteRunRecord[],
  next: DeterministicVoteRunRecord,
): DeterministicVoteRunRecord[] {
  const rest = results.filter((result) => result.index !== next.index)
  return [...rest, next].sort((a, b) => a.index - b.index)
}

function summarize(results: DeterministicVoteRunRecord[]): Record<string, number> {
  return results.reduce<Record<string, number>>((acc, result) => {
    acc[result.status] = (acc[result.status] ?? 0) + 1
    return acc
  }, {})
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  const options = parseOptions(argv)
  const network = getNetwork()
  const verificationContractId = process.env.NEXT_PUBLIC_NEAR_VERIFICATION_CONTRACT
  const parentAccountId = process.env.NEAR_ACCOUNT_ID
  const parentPrivateKey = process.env.NEAR_PRIVATE_KEY

  if (!verificationContractId) {
    throw new Error("NEXT_PUBLIC_NEAR_VERIFICATION_CONTRACT is required")
  }

  if (!parentPrivateKey || !parentAccountId) {
    throw new Error("NEAR_ACCOUNT_ID and NEAR_PRIVATE_KEY are required")
  }

  const manifest = readManifest(options.manifestPath)
  if (!manifest) {
    throw new Error(`Manifest file not found: ${options.manifestPath}`)
  }

  const provider = createScriptRpcProvider(options.rpcUrl)
  const report = buildReport(options, network)

  for (let i = options.startIndex; i < options.startIndex + options.count; i++) {
    const manifestRecord = manifest.accounts.find((record) => record.index === i)

    if (!manifestRecord) {
      report.results = upsertResult(report.results, {
        index: i,
        accountId: "unknown",
        publicKey: "unknown",
        status: "failed",
        relayTxHash: null,
        relayReason: null,
        error: `Index ${i} not present in manifest`,
      })
      writeJsonFile(options.reportPath, report)
      if (options.failFast) break
      continue
    }

    const derivedKey = deriveDeterministicVoterKey(parentPrivateKey, i)
    const derivedPublicKey = derivedKey.getPublicKey().toString()
    const derivedAccountId = buildDeterministicVoterAccountId(
      manifest.parentAccountId,
      manifest.naming.prefix,
      i,
      manifest.naming.pad,
    )

    try {
      ensureManifestRecordMatchesDerived(manifestRecord, derivedAccountId, derivedPublicKey)

      const result = await withRateLimitRetry(async (): Promise<DeterministicVoteRunRecord> => {
        const exists = await accountExists(provider, manifestRecord.accountId)
        if (!exists) {
          throw new Error("Account does not exist on-chain")
        }

        const verified = await isVerified(provider, verificationContractId, manifestRecord.accountId)
        if (!verified) {
          return {
            index: i,
            accountId: manifestRecord.accountId,
            publicKey: manifestRecord.publicKey,
            status: "skipped_unverified",
            relayTxHash: null,
            relayReason: "not_verified",
            error: "Account is not verified on verification contract",
          }
        }

        const proposalStatus = await getProposalStatus(provider, options.governanceContractId, options.proposalId)
        if (proposalStatus !== "active") {
          throw new Error(`Proposal is not active (current status: ${proposalStatus})`)
        }

        const alreadyVoted = await hasVoted(
          provider,
          options.governanceContractId,
          options.proposalId,
          manifestRecord.accountId,
        )
        if (alreadyVoted) {
          return {
            index: i,
            accountId: manifestRecord.accountId,
            publicKey: manifestRecord.publicKey,
            status: "already_voted",
            relayTxHash: null,
            relayReason: null,
            error: null,
          }
        }

        if (options.dryRun) {
          return {
            index: i,
            accountId: manifestRecord.accountId,
            publicKey: manifestRecord.publicKey,
            status: "skipped_dry_run",
            relayTxHash: null,
            relayReason: null,
            error: null,
          }
        }

        const voterSigner = new KeyPairSigner(derivedKey)
        const voterAccount = new Account(manifestRecord.accountId, provider, voterSigner)

        const action = actionCreators.functionCall(
          "cast_vote",
          { proposal_id: options.proposalId, choice: options.choice },
          GAS_100_TGAS_BIGINT,
          BigInt(0),
        )

        const [, signedDelegate] = await voterAccount.createSignedMetaTransaction(
          options.governanceContractId,
          [action],
          options.maxBlockHeightWindow,
        )

        const encoded = Buffer.from(encodeSignedDelegate(signedDelegate)).toString("base64")
        const response = await fetch(options.relayUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ signedDelegate: encoded }),
        })

        const responseBody = await response.json().catch(() => null)
        const classified = classifyRelayResponse(response.status, responseBody)

        return {
          index: i,
          accountId: manifestRecord.accountId,
          publicKey: manifestRecord.publicKey,
          status: classified.status,
          relayTxHash: classified.relayTxHash,
          relayReason: classified.relayReason,
          error: classified.error,
        }
      })

      report.results = upsertResult(report.results, result)
      writeJsonFile(options.reportPath, report)
      if (options.failFast && result.status === "failed") {
        break
      }
      if (options.failFast && result.status === "skipped_unverified") {
        break
      }
    } catch (error) {
      report.results = upsertResult(report.results, {
        index: i,
        accountId: manifestRecord.accountId,
        publicKey: manifestRecord.publicKey,
        status: "failed",
        relayTxHash: null,
        relayReason: null,
        error: formatError(error),
      })
      writeJsonFile(options.reportPath, report)
      if (options.failFast) break
    }
  }

  report.endedAt = new Date().toISOString()
  writeJsonFile(options.reportPath, report)

  const summary = summarize(report.results)
  console.log("Vote run summary:")
  for (const [status, count] of Object.entries(summary)) {
    console.log(`  ${status}: ${count}`)
  }
  console.log(`Report: ${options.reportPath}`)

  return report.results.some((result) => result.status === "failed") ? 1 : 0
}

main()
  .then((code) => process.exit(code))
  .catch((error) => {
    const message = isRecord(error) ? String(error.message ?? error) : String(error)
    console.error("Vote script failed:", message)
    process.exit(1)
  })
