import { test, expect } from "@playwright/test"
import type { APIRequestContext } from "@playwright/test"
import { requireEnv, callViewMethod } from "./utils/near-rpc"

const contractId = requireEnv("NEAR_CONTRACT_ID")
const backendWallet = requireEnv("NEAR_BACKEND_WALLET")
const rpcUrl = process.env.NEAR_RPC_URL ?? "https://rpc.mainnet.fastnear.com"

test("NEAR contract state health", async ({ request }: { request: APIRequestContext }) => {
  await test.step("Contract is not paused", async () => {
    const isPaused = await callViewMethod(request, rpcUrl, contractId, "is_paused")
    expect(isPaused, "Contract should not be paused").toBe(false)
  })

  await test.step("Backend wallet is correct", async () => {
    const backend = await callViewMethod(request, rpcUrl, contractId, "get_backend_wallet")
    expect(backend, "Backend wallet should match expected").toBe(backendWallet)
  })

  await test.step("State version is valid", async () => {
    const stateVersion = Number(await callViewMethod(request, rpcUrl, contractId, "get_state_version"))
    if (!Number.isFinite(stateVersion)) {
      throw new Error("Invalid state version response")
    }
    expect(stateVersion, "State version should be 1").toBe(1)
  })
})
