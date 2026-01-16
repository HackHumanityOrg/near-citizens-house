import { expect } from "@playwright/test"
import type { APIRequestContext } from "@playwright/test"

export type NearBlocksTxn = {
  block_timestamp?: string
  receipt_block?: { block_timestamp?: string }
  receipt_outcome?: { status?: boolean }
  outcomes?: { status?: boolean }
  predecessor_account_id?: string
  transaction_hash?: string
  receipt_id?: string
  id?: string
}

export const DAY_MS = 24 * 60 * 60 * 1000
export const NS_PER_MS = BigInt(1_000_000)
export const DAY_NS = BigInt(DAY_MS) * NS_PER_MS

export function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

export function encodeArgs(args: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(args)).toString("base64")
}

export function parseRpcResult(payload: unknown): unknown {
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

export async function callViewMethod(
  request: APIRequestContext,
  rpcUrl: string,
  contractId: string,
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

export function getTxnTimestampNs(txn: NearBlocksTxn): bigint | null {
  const timestamp = txn.block_timestamp ?? txn.receipt_block?.block_timestamp
  if (!timestamp) {
    return null
  }

  try {
    return BigInt(timestamp)
  } catch {
    return null
  }
}

export function getReceiptStatus(txn: NearBlocksTxn): boolean | null {
  const status = txn.receipt_outcome?.status ?? txn.outcomes?.status
  return typeof status === "boolean" ? status : null
}

export function getTxnId(txn: NearBlocksTxn): string {
  return txn.transaction_hash || txn.receipt_id || txn.id || "unknown"
}

export async function fetchNearBlocksTxns(
  request: APIRequestContext,
  nearblocksUrl: string,
  contractId: string,
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
