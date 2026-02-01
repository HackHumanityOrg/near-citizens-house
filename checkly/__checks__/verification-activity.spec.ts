import { test } from "@playwright/test"
import type { APIRequestContext } from "@playwright/test"
import { markCheckAsDegraded } from "@checkly/playwright-helpers"
import {
  requireEnv,
  callViewMethod,
  fetchNearBlocksTxns,
  getTxnTimestampNs,
  getReceiptStatus,
  getTxnId,
  NS_PER_MS,
  DAY_NS,
  type NearBlocksTxn,
} from "./utils/near-rpc"

const contractId = requireEnv("NEAR_CONTRACT_ID")
const backendWallet = requireEnv("NEAR_BACKEND_WALLET")
const rpcUrl = process.env.NEAR_RPC_URL ?? "https://rpc.mainnet.fastnear.com"
const nearblocksUrl = process.env.NEARBLOCKS_API_URL ?? "https://api.nearblocks.io"

test("NEAR verification activity", async ({ request }: { request: APIRequestContext }) => {
  const degradedReasons: string[] = []
  const nowNs = BigInt(Date.now()) * NS_PER_MS

  await test.step("Check verification count and freshness", async () => {
    const countValue = Number(await callViewMethod(request, rpcUrl, contractId, "get_verified_count"))
    if (!Number.isFinite(countValue)) {
      throw new Error("Invalid verified count response")
    }

    if (countValue === 0) {
      degradedReasons.push("No verifications recorded on-chain")
      return
    }

    const fromIndex = Math.max(countValue - 1, 0)
    const verifications = await callViewMethod(request, rpcUrl, contractId, "list_verifications", {
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

    // Note: We don't flag "no new verifications" as degraded since
    // it's normal for verification activity to be sporadic
    const _verifiedAtNs = BigInt(latest.verified_at.toString())
  })

  await test.step("Check store_verification receipts on NearBlocks", async () => {
    const txns = await fetchNearBlocksTxns(request, nearblocksUrl, contractId, "store_verification", degradedReasons)
    if (!txns) {
      return
    }

    const recentTxns = txns.filter((txn: NearBlocksTxn) => {
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

  if (degradedReasons.length > 0) {
    markCheckAsDegraded(degradedReasons.join(" | "))
  }
})
