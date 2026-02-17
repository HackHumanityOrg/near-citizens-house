#!/usr/bin/env npx tsx
/**
 * Bootstrap deterministic voter accounts and optionally verify them on-chain.
 *
 * What this script does:
 * - Derives deterministic voter keys from NEAR_PRIVATE_KEY + index
 * - Creates subaccounts under NEAR_ACCOUNT_ID if missing
 * - Ensures parent backup key exists on each voter account
 * - Calls store_verification on NEXT_PUBLIC_NEAR_VERIFICATION_CONTRACT (unless --skip-verify)
 * - Writes/updates a manifest JSON for later automated voting
 *
 * Required environment variables:
 * - NEAR_ACCOUNT_ID
 * - NEAR_PRIVATE_KEY
 * - NEXT_PUBLIC_NEAR_VERIFICATION_CONTRACT
 * - NEXT_PUBLIC_NEAR_NETWORK (mainnet|testnet)
 *
 * Optional environment variables:
 * - NEXT_PUBLIC_APP_URL (used in NEP-413 challenge string)
 * - FASTNEAR_API_KEY
 *
 * Usage:
 * - pnpm bootstrap:voters -- --start-index 0 --count 10
 * - pnpm bootstrap:voters -- --start-index 100 --count 20 --prefix voter --pad 4
 * - pnpm bootstrap:voters -- --start-index 0 --count 5 --skip-verify
 * - pnpm bootstrap:voters -- --start-index 0 --count 5 --dry-run
 *
 * Useful flags:
 * - --manifest <path>         Custom manifest output path
 * - --fund-yocto <amount>     Initial balance for newly created subaccounts
 *                              (default: minimum storage stake for account + 2 full-access keys)
 * - --rpc-url <url>           Override RPC endpoint
 */

import { randomBytes } from "crypto"
import { Account } from "@near-js/accounts"
import { KeyPair } from "@near-js/crypto"
import type { KeyPairString } from "@near-js/crypto"
import { KeyPairSigner } from "@near-js/signers"
import { JsonRpcProvider } from "@near-js/providers"
import { actionCreators } from "@near-js/transactions"
import { GAS_100_TGAS } from "../lib/contracts/gas"
import { nearAccessKeyResponseSchema } from "../lib/schemas/near"
import {
  buildDerivationSpec,
  buildDeterministicVoterAccountId,
  deriveDeterministicVoterKey,
  type DeterministicVoterManifest,
  type DeterministicVoterRecord,
  upsertManifestRecord,
} from "./helpers/deterministic-voter-keys"
import { readManifest, resolveDefaultManifestPath, writeJsonFile } from "./helpers/deterministic-voter-io"
import { loadNearestEnvFile } from "./helpers/load-env"
import { createScriptRpcProvider, getDefaultRpcUrl, rethrowIfRateLimit, withRateLimitRetry } from "./helpers/rpc"

interface BootstrapOptions {
  startIndex: number
  count: number
  prefix: string
  pad: number
  manifestPath: string
  fundYocto?: string
  dryRun: boolean
  skipVerify: boolean
  rpcUrl: string
}

interface ResolvedBootstrapOptions extends Omit<BootstrapOptions, "fundYocto"> {
  fundYocto: string
}

// NEAR account creation storage model (nearcore):
// storage_usage = num_bytes_account + N * (num_extra_bytes_record + borsh(public_key) + borsh(access_key))
// For an ed25519 full-access key, borsh(public_key)=33 bytes and borsh(access_key)=9 bytes.
const FULL_ACCESS_KEY_BORSH_PUBLIC_KEY_BYTES = BigInt(33)
const FULL_ACCESS_KEY_BORSH_ACCESS_KEY_BYTES = BigInt(9)
const DEFAULT_STORAGE_AMOUNT_PER_BYTE = BigInt("10000000000000000000")
const DEFAULT_NUM_BYTES_ACCOUNT = BigInt(100)
const DEFAULT_NUM_EXTRA_BYTES_RECORD = BigInt(40)

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

function parseOptions(argv: string[]): BootstrapOptions {
  const raw = parseCliArgs(argv)
  const network = getNetwork()

  const startIndex = parsePositiveInt(asString(raw["start-index"]), "start-index")
  const count = parsePositiveInt(asString(raw["count"]), "count")

  if (count <= 0) {
    throw new Error("--count must be greater than 0")
  }

  const prefix = asString(raw.prefix) ?? "voter"
  const pad = Number.parseInt(asString(raw.pad) ?? "4", 10)
  const manifestPath = asString(raw.manifest) ?? resolveDefaultManifestPath(network)
  const fundYocto = asString(raw["fund-yocto"])
  if (fundYocto !== undefined) {
    parseNonNegativeBigInt(fundYocto, "fund-yocto")
  }

  return {
    startIndex,
    count,
    prefix,
    pad: Number.isFinite(pad) && pad > 0 ? pad : 4,
    manifestPath,
    fundYocto,
    dryRun: Boolean(raw["dry-run"]),
    skipVerify: Boolean(raw["skip-verify"]),
    rpcUrl: asString(raw["rpc-url"]) ?? getDefaultRpcUrl(network),
  }
}

function asString(value: string | boolean | undefined): string | undefined {
  return typeof value === "string" ? value : undefined
}

function getNetwork(): "mainnet" | "testnet" {
  return process.env.NEXT_PUBLIC_NEAR_NETWORK === "mainnet" ? "mainnet" : "testnet"
}

function getSigningMessage(verificationContractId: string): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://citizenshouse.org"
  return `Identify myself for ${verificationContractId} at ${appUrl}`
}

function formatError(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error)
}

function parseNonNegativeBigInt(value: string, field: string): bigint {
  if (!/^\d+$/.test(value)) {
    throw new Error(`Invalid --${field}: ${value}`)
  }

  return BigInt(value)
}

function extractTxHash(outcome: unknown): string | null {
  if (!isRecord(outcome)) return null

  const txOutcome = outcome.transaction_outcome
  if (isRecord(txOutcome) && typeof txOutcome.id === "string") {
    return txOutcome.id
  }

  const tx = outcome.transaction
  if (isRecord(tx) && typeof tx.hash === "string") {
    return tx.hash
  }

  return null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function readBigIntField(record: Record<string, unknown>, key: string): bigint | null {
  const value = record[key]
  if (typeof value === "string" && /^\d+$/.test(value)) {
    return BigInt(value)
  }
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return BigInt(Math.trunc(value))
  }
  return null
}

function readStorageConfig(protocolConfig: unknown): {
  storageAmountPerByte: bigint
  numBytesAccount: bigint
  numExtraBytesRecord: bigint
} | null {
  if (!isRecord(protocolConfig)) return null
  const runtimeConfig = protocolConfig.runtime_config
  if (!isRecord(runtimeConfig)) return null

  const storageAmountPerByte = readBigIntField(runtimeConfig, "storage_amount_per_byte")
  if (storageAmountPerByte === null) return null

  const storageUsageConfig = runtimeConfig.storage_usage_config
  if (!isRecord(storageUsageConfig)) return null

  const numBytesAccount = readBigIntField(storageUsageConfig, "num_bytes_account")
  const numExtraBytesRecord = readBigIntField(storageUsageConfig, "num_extra_bytes_record")
  if (numBytesAccount === null || numExtraBytesRecord === null) return null

  return { storageAmountPerByte, numBytesAccount, numExtraBytesRecord }
}

function estimateRequiredStorageBytesForTwoFullAccessKeys(params: {
  numBytesAccount: bigint
  numExtraBytesRecord: bigint
}): bigint {
  const perKeyStorage =
    params.numExtraBytesRecord + FULL_ACCESS_KEY_BORSH_PUBLIC_KEY_BYTES + FULL_ACCESS_KEY_BORSH_ACCESS_KEY_BYTES
  return params.numBytesAccount + perKeyStorage * BigInt(2)
}

function computeMinimumCreateBalanceYocto(params: {
  storageAmountPerByte: bigint
  numBytesAccount: bigint
  numExtraBytesRecord: bigint
}): bigint {
  const requiredBytes = estimateRequiredStorageBytesForTwoFullAccessKeys({
    numBytesAccount: params.numBytesAccount,
    numExtraBytesRecord: params.numExtraBytesRecord,
  })

  return requiredBytes * params.storageAmountPerByte
}

async function resolveDefaultFundingYocto(provider: JsonRpcProvider): Promise<string> {
  const fallback = computeMinimumCreateBalanceYocto({
    storageAmountPerByte: DEFAULT_STORAGE_AMOUNT_PER_BYTE,
    numBytesAccount: DEFAULT_NUM_BYTES_ACCOUNT,
    numExtraBytesRecord: DEFAULT_NUM_EXTRA_BYTES_RECORD,
  }).toString()

  try {
    const protocolConfig = await provider.experimental_protocolConfig({ finality: "final" })
    const parsed = readStorageConfig(protocolConfig)
    if (!parsed) return fallback

    return computeMinimumCreateBalanceYocto({
      storageAmountPerByte: parsed.storageAmountPerByte,
      numBytesAccount: parsed.numBytesAccount,
      numExtraBytesRecord: parsed.numExtraBytesRecord,
    }).toString()
  } catch {
    return fallback
  }
}

function isFullAccess(permission: unknown): boolean {
  if (permission === "FullAccess") return true
  if (!isRecord(permission)) return false
  return "FullAccess" in permission
}

async function accountExists(provider: JsonRpcProvider, accountId: string): Promise<boolean> {
  try {
    await provider.query({
      request_type: "view_account",
      finality: "final",
      account_id: accountId,
    })
    return true
  } catch (error) {
    rethrowIfRateLimit(error)
    return false
  }
}

async function hasFullAccessKey(provider: JsonRpcProvider, accountId: string, publicKey: string): Promise<boolean> {
  try {
    const response = await provider.query({
      request_type: "view_access_key",
      finality: "final",
      account_id: accountId,
      public_key: publicKey,
    })
    const parsed = nearAccessKeyResponseSchema.safeParse(response)
    if (!parsed.success) return false
    return isFullAccess(parsed.data.permission)
  } catch (error) {
    rethrowIfRateLimit(error)
    return false
  }
}

async function isVerified(
  provider: JsonRpcProvider,
  verificationContractId: string,
  accountId: string,
): Promise<boolean> {
  try {
    const result = await provider.callFunction<boolean>(verificationContractId, "is_verified", {
      account_id: accountId,
    })
    return result ?? false
  } catch (error) {
    rethrowIfRateLimit(error)
    return false
  }
}

function createEmptyManifest(params: {
  network: "mainnet" | "testnet"
  parentAccountId: string
  verificationContractId: string
  startIndex: number
  count: number
  prefix: string
  pad: number
}): DeterministicVoterManifest {
  return {
    version: 1,
    network: params.network,
    parentAccountId: params.parentAccountId,
    verificationContractId: params.verificationContractId,
    derivation: buildDerivationSpec(),
    naming: {
      prefix: params.prefix,
      pad: params.pad,
      startIndex: params.startIndex,
      count: params.count,
    },
    createdAt: new Date().toISOString(),
    accounts: [],
  }
}

function ensureManifestCompatibility(
  existing: DeterministicVoterManifest,
  parentAccountId: string,
  verificationContractId: string,
  network: "mainnet" | "testnet",
): void {
  if (existing.parentAccountId !== parentAccountId) {
    throw new Error(
      `Manifest parent account mismatch: ${existing.parentAccountId} != ${parentAccountId}. Use a separate manifest path.`,
    )
  }

  if (existing.verificationContractId !== verificationContractId) {
    throw new Error(
      `Manifest verification contract mismatch: ${existing.verificationContractId} != ${verificationContractId}. Use a separate manifest path.`,
    )
  }

  if (existing.network !== network) {
    throw new Error(`Manifest network mismatch: ${existing.network} != ${network}. Use a separate manifest path.`)
  }
}

async function verifyOnChain(params: {
  parentAccount: Account
  voterAccount: Account
  verificationContractId: string
  accountId: string
}): Promise<{ status: "verified_now" | "already_verified"; txHash: string | null }> {
  const { parentAccount, voterAccount, verificationContractId, accountId } = params

  const already = await isVerified(parentAccount.provider as JsonRpcProvider, verificationContractId, accountId)
  if (already) {
    return { status: "already_verified", txHash: null }
  }

  const nonceBytes = randomBytes(32)
  const nonce = nonceBytes.toString("base64")
  const timestamp = Date.now()
  const challenge = getSigningMessage(verificationContractId)

  const signed = await voterAccount.signNep413Message({
    message: challenge,
    recipient: verificationContractId,
    nonce: nonceBytes,
  })

  const signature = Buffer.from(signed.signature).toString("base64")
  const publicKey = signed.publicKey.toString()

  const userContextData = JSON.stringify({
    accountId,
    publicKey,
    signature,
    nonce,
    timestamp,
  })

  try {
    const outcome = await parentAccount.callFunctionRaw({
      contractId: verificationContractId,
      methodName: "store_verification",
      args: {
        near_account_id: accountId,
        signature_data: {
          account_id: accountId,
          signature,
          public_key: publicKey,
          challenge,
          nonce,
          recipient: verificationContractId,
        },
        user_context_data: userContextData,
      },
      gas: GAS_100_TGAS,
      deposit: "1",
      waitUntil: "EXECUTED_OPTIMISTIC",
    })

    return { status: "verified_now", txHash: extractTxHash(outcome) }
  } catch (error) {
    const message = formatError(error).toLowerCase()
    if (message.includes("already verified")) {
      return { status: "already_verified", txHash: null }
    }
    throw error
  }
}

async function processIndex(params: {
  index: number
  options: ResolvedBootstrapOptions
  provider: JsonRpcProvider
  parentAccount: Account
  parentAccountId: string
  parentPublicKey: string
  parentPrivateKey: string
  verificationContractId: string
}): Promise<DeterministicVoterRecord> {
  const {
    index,
    options,
    provider,
    parentAccount,
    parentAccountId,
    parentPublicKey,
    parentPrivateKey,
    verificationContractId,
  } = params

  const voterKey = deriveDeterministicVoterKey(parentPrivateKey, index)
  const voterPublicKey = voterKey.getPublicKey().toString()
  const accountId = buildDeterministicVoterAccountId(parentAccountId, options.prefix, index, options.pad)

  const baseRecord: DeterministicVoterRecord = {
    index,
    accountId,
    publicKey: voterPublicKey,
    verified: false,
    createTxHash: null,
    verifyTxHash: null,
    status: "pending",
    error: null,
  }

  if (options.dryRun) {
    const verified = options.skipVerify ? false : await isVerified(provider, verificationContractId, accountId)
    return {
      ...baseRecord,
      verified,
      status: "dry_run_planned",
    }
  }

  const exists = await accountExists(provider, accountId)

  if (!exists) {
    const createOutcome = await parentAccount.signAndSendTransaction({
      receiverId: accountId,
      actions: [
        actionCreators.createAccount(),
        actionCreators.transfer(BigInt(options.fundYocto)),
        actionCreators.addKey(voterKey.getPublicKey(), actionCreators.fullAccessKey()),
        actionCreators.addKey(
          KeyPair.fromString(parentPrivateKey as KeyPairString).getPublicKey(),
          actionCreators.fullAccessKey(),
        ),
      ],
      waitUntil: "EXECUTED_OPTIMISTIC",
    })
    baseRecord.createTxHash = extractTxHash(createOutcome)
  } else {
    const voterKeyHasAccess = await hasFullAccessKey(provider, accountId, voterPublicKey)
    if (!voterKeyHasAccess) {
      // Try to recover: if parent key exists, use it to add the voter key
      const parentHasAccess = await hasFullAccessKey(provider, accountId, parentPublicKey)
      if (!parentHasAccess) {
        return {
          ...baseRecord,
          status: "failed",
          error: "Existing account is missing both voter and parent full-access keys",
        }
      }
      const parentSigner = new KeyPairSigner(KeyPair.fromString(parentPrivateKey as KeyPairString))
      const parentOwnedAccount = new Account(accountId, provider, parentSigner)
      try {
        await parentOwnedAccount.addFullAccessKey(voterKey.getPublicKey().toString())
      } catch (error) {
        const msg = formatError(error).toLowerCase()
        if (!msg.includes("already exists") && !msg.includes("already used")) {
          throw error
        }
      }
    } else {
      // Voter key exists — ensure parent key is also present
      const parentHasAccess = await hasFullAccessKey(provider, accountId, parentPublicKey)
      if (!parentHasAccess) {
        const voterSigner = new KeyPairSigner(voterKey)
        const voterAccount = new Account(accountId, provider, voterSigner)
        try {
          const addOutcome = await voterAccount.addFullAccessKey(parentPublicKey)
          baseRecord.createTxHash = extractTxHash(addOutcome)
        } catch (error) {
          const msg = formatError(error).toLowerCase()
          if (!msg.includes("already exists") && !msg.includes("already used")) {
            throw error
          }
        }
      }
    }
  }

  if (options.skipVerify) {
    const verified = await isVerified(provider, verificationContractId, accountId)
    return {
      ...baseRecord,
      verified,
      status: exists ? "existing_unverified" : "created_unverified",
    }
  }

  const voterSigner = new KeyPairSigner(voterKey)
  const voterAccount = new Account(accountId, provider, voterSigner)
  const verificationResult = await verifyOnChain({
    parentAccount,
    voterAccount,
    verificationContractId,
    accountId,
  })

  return {
    ...baseRecord,
    verified: true,
    verifyTxHash: verificationResult.txHash,
    status:
      verificationResult.status === "already_verified"
        ? "already_verified"
        : exists
          ? "existing_verified_now"
          : "created_verified",
  }
}

function summarize(records: DeterministicVoterRecord[]): Record<string, number> {
  return records.reduce<Record<string, number>>((acc, record) => {
    acc[record.status] = (acc[record.status] ?? 0) + 1
    return acc
  }, {})
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  const options = parseOptions(argv)

  const parentAccountId = process.env.NEAR_ACCOUNT_ID
  const parentPrivateKey = process.env.NEAR_PRIVATE_KEY
  const verificationContractId = process.env.NEXT_PUBLIC_NEAR_VERIFICATION_CONTRACT

  if (!parentAccountId || !parentPrivateKey) {
    throw new Error("NEAR_ACCOUNT_ID and NEAR_PRIVATE_KEY are required")
  }

  if (!verificationContractId) {
    throw new Error("NEXT_PUBLIC_NEAR_VERIFICATION_CONTRACT is required")
  }

  const network = getNetwork()
  const provider = createScriptRpcProvider(options.rpcUrl)
  const effectiveFundYocto = options.fundYocto ?? (await resolveDefaultFundingYocto(provider))
  const resolvedOptions: ResolvedBootstrapOptions = {
    ...options,
    fundYocto: effectiveFundYocto,
  }

  if (!options.fundYocto) {
    console.log(`No --fund-yocto provided, using minimum storage stake: ${effectiveFundYocto} yoctoNEAR`)
  }

  const parentKey = KeyPair.fromString(parentPrivateKey as KeyPairString)
  const parentSigner = new KeyPairSigner(parentKey)
  const parentAccount = new Account(parentAccountId, provider, parentSigner)
  const parentPublicKey = parentKey.getPublicKey().toString()

  const existingManifest = readManifest(options.manifestPath)
  if (existingManifest) {
    ensureManifestCompatibility(existingManifest, parentAccountId, verificationContractId, network)
  }

  const manifest =
    existingManifest ??
    createEmptyManifest({
      network,
      parentAccountId,
      verificationContractId,
      startIndex: options.startIndex,
      count: options.count,
      prefix: options.prefix,
      pad: options.pad,
    })

  manifest.naming = {
    prefix: options.prefix,
    pad: options.pad,
    startIndex: options.startIndex,
    count: options.count,
  }

  const processed: DeterministicVoterRecord[] = []

  for (let i = options.startIndex; i < options.startIndex + options.count; i++) {
    try {
      const record = await withRateLimitRetry(() =>
        processIndex({
          index: i,
          options: resolvedOptions,
          provider,
          parentAccount,
          parentAccountId,
          parentPublicKey,
          parentPrivateKey,
          verificationContractId,
        }),
      )

      manifest.accounts = upsertManifestRecord(manifest.accounts, record)
      processed.push(record)
      writeJsonFile(resolvedOptions.manifestPath, manifest)
    } catch (error) {
      const accountId = buildDeterministicVoterAccountId(
        parentAccountId,
        resolvedOptions.prefix,
        i,
        resolvedOptions.pad,
      )
      const fallback: DeterministicVoterRecord = {
        index: i,
        accountId,
        publicKey: deriveDeterministicVoterKey(parentPrivateKey, i).getPublicKey().toString(),
        verified: false,
        createTxHash: null,
        verifyTxHash: null,
        status: "failed",
        error: formatError(error),
      }
      manifest.accounts = upsertManifestRecord(manifest.accounts, fallback)
      processed.push(fallback)
      writeJsonFile(resolvedOptions.manifestPath, manifest)
    }
  }

  manifest.createdAt = new Date().toISOString()
  writeJsonFile(resolvedOptions.manifestPath, manifest)

  const summary = summarize(processed)
  console.log("Bootstrap summary:")
  for (const [status, count] of Object.entries(summary)) {
    console.log(`  ${status}: ${count}`)
  }
  console.log(`Manifest: ${resolvedOptions.manifestPath}`)

  return processed.some((record) => record.status === "failed") ? 1 : 0
}

main()
  .then((code) => process.exit(code))
  .catch((error) => {
    console.error("Bootstrap script failed:", formatError(error))
    process.exit(1)
  })
