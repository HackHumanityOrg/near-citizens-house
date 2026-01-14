import { test, expect } from "@playwright/test"
import type { APIRequestContext } from "@playwright/test"
import { markCheckAsDegraded } from "@checkly/playwright-helpers"

type NearBlocksTxn = {
  block_timestamp?: string
  receipt_block?: { block_timestamp?: string }
  receipt_outcome?: { status?: boolean }
  outcomes?: { status?: boolean }
  predecessor_account_id?: string
  transaction_hash?: string
  receipt_id?: string
  id?: string
}

const contractId = requireEnv("NEAR_CONTRACT_ID")
const backendWallet = requireEnv("NEAR_BACKEND_WALLET")
const rpcUrl = process.env.NEAR_RPC_URL ?? "https://rpc.mainnet.fastnear.com"
const nearblocksUrl = process.env.NEARBLOCKS_API_URL ?? "https://api.nearblocks.io"

const DAY_MS = 24 * 60 * 60 * 1000
const NS_PER_MS = BigInt(1_000_000)
const DAY_NS = BigInt(DAY_MS) * NS_PER_MS

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

function encodeArgs(args: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(args)).toString("base64")
}

function parseRpcResult(payload: unknown): unknown {
  if (!payload || typeof payload !== "object" || !("result" in payload)) {
    throw new Error("Invalid RPC response: missing result")
  }

  const result = (payload as { result?: { result?: number[] } }).result
  if (!result?.result || !Array.isArray(result.result)) {
    throw new Error("Invalid RPC response: missing result bytes")
  }

  const jsonString = Buffer.from(result.result).toString("utf8")
  if (!jsonString) {
    return null
  }

  try {
    return JSON.parse(jsonString)
  } catch (error) {
    throw new Error(`Failed to parse RPC JSON: ${error instanceof Error ? error.message : String(error)}`)
  }
}

async function callViewMethod(
  request: APIRequestContext,
  methodName: string,
  args: Record<string, unknown> = {},
): Promise<unknown> {
  const response = await request.post(rpcUrl, {
    data: {
      jsonrpc: "2.0",
      id: methodName,
      method: "query",
      params: {
        request_type: "call_function",
        account_id: contractId,
        method_name: methodName,
        args_base64: encodeArgs(args),
        finality: "final",
      },
    },
  })

  expect(response, `RPC ${methodName} should succeed`).toBeOK()
  const payload = await response.json()

  if (payload?.error) {
    throw new Error(`RPC ${methodName} error: ${JSON.stringify(payload.error)}`)
  }

  return parseRpcResult(payload)
}

function getTxnTimestampNs(txn: NearBlocksTxn): bigint | null {
  const timestamp = txn.block_timestamp ?? txn.receipt_block?.block_timestamp
  if (!timestamp) {
    return null
  }

  try {
    return BigInt(timestamp)
  } catch (error) {
    return null
  }
}

function getReceiptStatus(txn: NearBlocksTxn): boolean | null {
  const status = txn.receipt_outcome?.status ?? txn.outcomes?.status
  return typeof status === "boolean" ? status : null
}

function getTxnId(txn: NearBlocksTxn): string {
  return txn.transaction_hash || txn.receipt_id || txn.id || "unknown"
}

async function fetchNearBlocksTxns(
  request: APIRequestContext,
  methodName: string,
  degradedReasons: string[],
): Promise<NearBlocksTxn[] | null> {
  const url = `${nearblocksUrl}/v1/account/${contractId}/txns?method=${methodName}`
  const response = await request.get(url)

  if (!response.ok()) {
    degradedReasons.push(`NearBlocks ${methodName} HTTP ${response.status()}`)
    return null
  }

  const payload = await response.json().catch(() => null)
  if (!payload || !Array.isArray(payload.txns)) {
    degradedReasons.push(`NearBlocks ${methodName} missing txns array`)
    return null
  }

  return payload.txns as NearBlocksTxn[]
}

test("NEAR verified-accounts contract monitoring", async ({ request }: { request: APIRequestContext }) => {
  const degradedReasons: string[] = []
  const nowNs = BigInt(Date.now()) * NS_PER_MS

  await test.step("RPC: core health", async () => {
    const isPaused = await callViewMethod(request, "is_paused")
    expect(isPaused).toBe(false)

    const backend = await callViewMethod(request, "get_backend_wallet")
    expect(backend).toBe(backendWallet)

    const stateVersion = Number(await callViewMethod(request, "get_state_version"))
    if (!Number.isFinite(stateVersion)) {
      throw new Error("Invalid state version response")
    }
    expect(stateVersion).toBe(1)
  })

  await test.step("RPC: verification freshness", async () => {
    const countValue = Number(await callViewMethod(request, "get_verified_count"))
    if (!Number.isFinite(countValue)) {
      throw new Error("Invalid verified count response")
    }

    if (countValue === 0) {
      degradedReasons.push("No verifications recorded on-chain")
      return
    }

    const fromIndex = Math.max(countValue - 1, 0)
    const verifications = await callViewMethod(request, "list_verifications", {
      from_index: fromIndex,
      limit: 1,
    })

    if (!Array.isArray(verifications) || verifications.length === 0) {
      degradedReasons.push("Unable to load latest verification")
      return
    }

    const latest = verifications[verifications.length - 1] as { verified_at?: string | number }
    if (!latest?.verified_at) {
      degradedReasons.push("Latest verification missing verified_at")
      return
    }

    const verifiedAtNs = BigInt(latest.verified_at.toString())
    if (nowNs - verifiedAtNs > DAY_NS) {
      degradedReasons.push("No new verifications in the last 24 hours")
    }
  })

  await test.step("NearBlocks: store_verification receipts", async () => {
    const txns = await fetchNearBlocksTxns(request, "store_verification", degradedReasons)
    if (!txns) {
      return
    }

    const recentTxns = txns.filter((txn) => {
      const timestamp = getTxnTimestampNs(txn)
      return timestamp !== null && nowNs - timestamp <= DAY_NS
    })

    for (const txn of recentTxns) {
      const status = getReceiptStatus(txn)
      if (status === false) {
        degradedReasons.push(`store_verification failed in tx ${getTxnId(txn)}`)
        continue
      }

      if (txn.predecessor_account_id && txn.predecessor_account_id !== backendWallet) {
        throw new Error(
          `store_verification called by unexpected account ${txn.predecessor_account_id} in tx ${getTxnId(txn)}`,
        )
      }
    }
  })

  await test.step("NearBlocks: admin method calls", async () => {
    const adminMethods = ["pause", "unpause", "update_backend_wallet"]

    for (const methodName of adminMethods) {
      const txns = await fetchNearBlocksTxns(request, methodName, degradedReasons)
      if (!txns) {
        continue
      }

      const recentTxns = txns.filter((txn) => {
        const timestamp = getTxnTimestampNs(txn)
        return timestamp !== null && nowNs - timestamp <= DAY_NS
      })

      if (recentTxns.length > 0) {
        const recentId = getTxnId(recentTxns[0])
        throw new Error(`Admin method ${methodName} called in last 24h (${recentId})`)
      }
    }
  })

  if (degradedReasons.length > 0) {
    markCheckAsDegraded(degradedReasons.join(" | "))
  }
})
