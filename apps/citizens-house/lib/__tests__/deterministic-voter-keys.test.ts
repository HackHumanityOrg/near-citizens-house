import { describe, expect, it } from "vitest"
import { nearAccountIdSchema } from "@/lib/schemas/near"
import { deriveWorkerKey } from "../../e2e/helpers/deterministic-keys"
import {
  buildDeterministicVoterAccountId,
  deriveDeterministicVoterKey,
  deriveDeterministicVoterPublicKey,
} from "../../scripts/helpers/deterministic-voter-keys"

describe("deterministic voter key helpers", () => {
  const seed = "ed25519:example-seed-for-deterministic-tests"

  it("derives the same key for the same index", () => {
    const first = deriveDeterministicVoterKey(seed, 7).toString()
    const second = deriveDeterministicVoterKey(seed, 7).toString()
    expect(first).toBe(second)
  })

  it("derives unique keys across indices", () => {
    const key0 = deriveDeterministicVoterPublicKey(seed, 0)
    const key1 = deriveDeterministicVoterPublicKey(seed, 1)
    expect(key0).not.toBe(key1)
  })

  it("uses a distinct namespace from worker key derivation", () => {
    const voterKey = deriveDeterministicVoterPublicKey(seed, 2)
    const workerKey = deriveWorkerKey(seed, 2).getPublicKey().toString()
    expect(voterKey).not.toBe(workerKey)
  })

  it("builds valid, zero-padded account IDs", () => {
    const accountId = buildDeterministicVoterAccountId("hh-testinprod.near", "voter", 12, 4)
    expect(accountId).toBe("voter-0012.hh-testinprod.near")
    expect(nearAccountIdSchema.safeParse(accountId).success).toBe(true)
  })
})
