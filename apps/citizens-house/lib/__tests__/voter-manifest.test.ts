import { describe, expect, it } from "vitest"
import * as fs from "fs"
import * as path from "path"
import * as os from "os"
import {
  ensureManifestRecordMatchesDerived,
  type DeterministicVoterManifest,
  upsertManifestRecord,
} from "../../scripts/helpers/deterministic-voter-keys"
import {
  isManifestRecord,
  readManifest,
  resolveDefaultManifestPath,
  writeJsonFile,
} from "../../scripts/helpers/deterministic-voter-io"

describe("deterministic voter manifest helpers", () => {
  it("upserts records and keeps deterministic index ordering", () => {
    const records = [
      {
        index: 5,
        accountId: "voter-0005.hh-testinprod.near",
        publicKey: "ed25519:abc",
        verified: true,
        createTxHash: null,
        verifyTxHash: null,
        status: "ok",
        error: null,
      },
    ]

    const withLower = upsertManifestRecord(records, {
      index: 2,
      accountId: "voter-0002.hh-testinprod.near",
      publicKey: "ed25519:def",
      verified: false,
      createTxHash: null,
      verifyTxHash: null,
      status: "pending",
      error: null,
    })

    expect(withLower.map((r) => r.index)).toEqual([2, 5])

    const replaced = upsertManifestRecord(withLower, {
      index: 5,
      accountId: "voter-0005.hh-testinprod.near",
      publicKey: "ed25519:xyz",
      verified: true,
      createTxHash: "tx123",
      verifyTxHash: null,
      status: "updated",
      error: null,
    })

    expect(replaced).toHaveLength(2)
    expect(replaced[1]?.publicKey).toBe("ed25519:xyz")
  })

  it("detects manifest/derived mismatches", () => {
    expect(() =>
      ensureManifestRecordMatchesDerived(
        {
          index: 3,
          accountId: "voter-0003.hh-testinprod.near",
          publicKey: "ed25519:abc",
          verified: true,
          createTxHash: null,
          verifyTxHash: null,
          status: "ok",
          error: null,
        },
        "voter-0003.hh-testinprod.near",
        "ed25519:def",
      ),
    ).toThrow(/public key mismatch/i)
  })

  it("rejects records that attempt to include private key material", () => {
    const withSecret = {
      index: 1,
      accountId: "voter-0001.hh-testinprod.near",
      publicKey: "ed25519:abc",
      privateKey: "ed25519:secret",
      verified: true,
      createTxHash: null,
      verifyTxHash: null,
      status: "ok",
      error: null,
    }

    expect(isManifestRecord(withSecret)).toBe(false)
  })

  it("writes and reads manifests from disk", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "voter-manifest-"))
    const filePath = path.join(tmp, "manifest.json")

    const manifest: DeterministicVoterManifest = {
      version: 1,
      network: "mainnet",
      parentAccountId: "hh-testinprod.near",
      verificationContractId: "verification-v2.hh-testinprod.near",
      derivation: {
        namespace: "deterministic-voter",
        formula: "sha256(..)",
        seedSource: "NEAR_PRIVATE_KEY",
      },
      naming: {
        prefix: "voter",
        pad: 4,
        startIndex: 0,
        count: 1,
      },
      createdAt: new Date().toISOString(),
      accounts: [
        {
          index: 0,
          accountId: "voter-0000.hh-testinprod.near",
          publicKey: "ed25519:abc",
          verified: true,
          createTxHash: null,
          verifyTxHash: null,
          status: "created_verified",
          error: null,
        },
      ],
    }

    writeJsonFile(filePath, manifest)
    const loaded = readManifest(filePath)
    expect(loaded?.accounts[0]?.accountId).toBe("voter-0000.hh-testinprod.near")
  })

  it("resolves default manifest path by network", () => {
    const mainnetPath = resolveDefaultManifestPath("mainnet")
    expect(mainnetPath).toContain("deterministic-voters.mainnet.json")
  })
})
