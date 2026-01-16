import { test } from "@playwright/test"
import type { APIRequestContext } from "@playwright/test"
import { markCheckAsDegraded } from "@checkly/playwright-helpers"
import {
  requireEnv,
  fetchNearBlocksTxns,
  getTxnTimestampNs,
  getTxnId,
  NS_PER_MS,
  DAY_NS,
  type NearBlocksTxn,
} from "./utils/near-rpc"

const contractId = requireEnv("NEAR_CONTRACT_ID")
const nearblocksUrl = process.env.NEARBLOCKS_API_URL ?? "https://api.nearblocks.io"

const ADMIN_METHODS = ["pause", "unpause", "update_backend_wallet"]

test("NEAR contract security monitor", async ({ request }: { request: APIRequestContext }) => {
  const degradedReasons: string[] = []
  const nowNs = BigInt(Date.now()) * NS_PER_MS

  await test.step("Check for recent admin method calls", async () => {
    for (const methodName of ADMIN_METHODS) {
      const txns = await fetchNearBlocksTxns(request, nearblocksUrl, contractId, methodName, degradedReasons)
      if (!txns) {
        continue
      }

      const recentTxns = txns.filter((txn: NearBlocksTxn) => {
        const timestamp = getTxnTimestampNs(txn)
        return timestamp !== null && nowNs - timestamp <= DAY_NS
      })

      if (recentTxns.length > 0) {
        const recentId = getTxnId(recentTxns[0])
        // Admin method calls in the last 24h are a critical security alert
        throw new Error(`Admin method ${methodName} called in last 24h (${recentId})`)
      }
    }
  })

  if (degradedReasons.length > 0) {
    markCheckAsDegraded(degradedReasons.join(" | "))
  }
})
