/**
 * Custom ZK proof verification using Self.xyz's on-chain verifier directly
 *
 * This module provides Groth16 verification that bypasses Self.xyz SDK's
 * timestamp check, allowing stored proofs to be verified forever.
 *
 * The Self.xyz SDK has a hardcoded ~24 hour timeWindow that rejects
 * proofs with currentDateIndex older than this window. This module
 * calls the on-chain verifier contract on Celo directly, skipping
 * the SDK's business logic validation.
 */
import { ethers } from "ethers"
import type { SelfProofData } from "./contracts/verification"
import { SELF_CONFIG, CELO_CONFIG } from "./config"

export type { SelfProofData as StoredProofData }

// Self.xyz IdentityVerificationHub addresses
const IDENTITY_VERIFICATION_HUB_MAINNET = "0xe57F4773bd9c9d8b6Cd70431117d353298B9f5BF"
const IDENTITY_VERIFICATION_HUB_TESTNET = "0x16ECBA51e18a4a7e61fdC417f0d47AFEeDfbed74"

// Multiple free Celo RPC endpoints for automatic fallback
const CELO_RPC_URLS_MAINNET = [
  "https://1rpc.io/celo",
  "https://rpc.ankr.com/celo",
  "https://forno.celo.org",
  "https://celo-mainnet.public.blastapi.io",
  "https://celo-mainnet-rpc.allthatnode.com",
]

const CELO_RPC_URLS_TESTNET = ["https://alfajores-forno.celo-testnet.org"]

// Use config values for RPC URLs and Self.xyz network setting
// Self.xyz network is independent from NEAR network, allowing NEAR testnet + Self mainnet
const CELO_RPC_URLS = CELO_CONFIG.rpcUrls
  ? CELO_CONFIG.rpcUrls.map((url) => url.trim()).filter(Boolean)
  : SELF_CONFIG.networkId === "testnet"
    ? CELO_RPC_URLS_TESTNET
    : CELO_RPC_URLS_MAINNET

const IDENTITY_VERIFICATION_HUB_ADDRESS = SELF_CONFIG.networkId === "testnet"
  ? IDENTITY_VERIFICATION_HUB_TESTNET
  : IDENTITY_VERIFICATION_HUB_MAINNET

// Verifier contract ABI - just the verifyProof function we need
const VERIFIER_ABI = [
  {
    inputs: [
      { internalType: "uint256[2]", name: "a", type: "uint256[2]" },
      { internalType: "uint256[2][2]", name: "b", type: "uint256[2][2]" },
      { internalType: "uint256[2]", name: "c", type: "uint256[2]" },
      { internalType: "uint256[21]", name: "pubSignals", type: "uint256[21]" },
    ],
    name: "verifyProof",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
]

// IdentityVerificationHub ABI - to get verifier address
const HUB_ABI = [
  {
    inputs: [{ internalType: "bytes32", name: "attestationId", type: "bytes32" }],
    name: "discloseVerifier",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
]

// Cache the verifier address to avoid repeated lookups
let cachedVerifierAddress: string | null = null

// Cache successful RPC URL to reduce latency
let lastSuccessfulRpcUrl: string | null = null
let lastSuccessfulRpcTime: number = 0
const RPC_SUCCESS_CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

/**
 * Try multiple RPC providers with timeout handling
 * Rotates through available endpoints until one succeeds
 */
async function tryMultipleRpcProviders<T>(
  operation: (provider: ethers.JsonRpcProvider) => Promise<T>,
  timeoutMs: number = 5000,
): Promise<{ result: T; rpcUrl: string }> {
  const errors: Array<{ url: string; error: string }> = []

  // Try cached successful URL first if recent
  const now = Date.now()
  if (lastSuccessfulRpcUrl && now - lastSuccessfulRpcTime < RPC_SUCCESS_CACHE_DURATION) {
    try {
      const provider = new ethers.JsonRpcProvider(lastSuccessfulRpcUrl)
      const result = await Promise.race([
        operation(provider),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Timeout")), timeoutMs)),
      ])
      return { result, rpcUrl: lastSuccessfulRpcUrl }
    } catch {
      // Cached endpoint failed, will try other endpoints
      lastSuccessfulRpcUrl = null // Invalidate cache
    }
  }

  // Try each RPC URL in sequence
  for (const rpcUrl of CELO_RPC_URLS) {
    try {
      const provider = new ethers.JsonRpcProvider(rpcUrl)

      // Race between operation and timeout
      const result = await Promise.race([
        operation(provider),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`Timeout after ${timeoutMs}ms`)), timeoutMs),
        ),
      ])

      // Success! Cache this URL
      lastSuccessfulRpcUrl = rpcUrl
      lastSuccessfulRpcTime = Date.now()

      return { result, rpcUrl }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      errors.push({ url: rpcUrl, error: errorMsg })
      // Continue to next endpoint immediately (no delay)
    }
  }

  // All endpoints failed
  const errorDetails = errors.map((e) => `${e.url}: ${e.error}`).join("; ")
  throw new Error(`All Celo RPC endpoints failed. Errors: ${errorDetails}`)
}

/**
 * Get the verifier contract address from the hub
 */
async function getVerifierAddress(attestationId: number): Promise<string> {
  if (cachedVerifierAddress) {
    return cachedVerifierAddress
  }

  const { result: verifierAddress } = await tryMultipleRpcProviders(async (provider) => {
    const hubContract = new ethers.Contract(IDENTITY_VERIFICATION_HUB_ADDRESS, HUB_ABI, provider)

    // Convert attestationId to bytes32 format
    const attestationIdBytes32 = "0x" + attestationId.toString(16).padStart(64, "0")
    const verifierAddress = await hubContract.discloseVerifier(attestationIdBytes32)

    if (verifierAddress === "0x0000000000000000000000000000000000000000") {
      throw new Error("Verifier contract not found for attestation ID: " + attestationId)
    }

    return verifierAddress
  })

  cachedVerifierAddress = verifierAddress
  return verifierAddress
}

/**
 * Verify a stored Groth16 proof without timestamp validation
 *
 * This bypasses Self.xyz SDK's timeWindow check for historical proofs
 * by calling the on-chain verifier contract directly on Celo.
 *
 * @param storedProof - The proof data containing proof points and public signals
 * @param attestationId - The attestation type (1=Passport, 2=BiometricID, 3=Aadhaar)
 * @returns true if the proof is mathematically valid, false otherwise
 */
export async function verifyStoredProof(storedProof: SelfProofData, attestationId: number = 1): Promise<boolean> {
  const verifierAddress = await getVerifierAddress(attestationId)

  // Convert proof to the format expected by the contract
  // Note: b coordinates need to be swapped
  const proof = {
    a: storedProof.proof.a.map(BigInt),
    b: [
      [BigInt(storedProof.proof.b[0][1]), BigInt(storedProof.proof.b[0][0])],
      [BigInt(storedProof.proof.b[1][1]), BigInt(storedProof.proof.b[1][0])],
    ],
    c: storedProof.proof.c.map(BigInt),
  }

  const publicSignals = storedProof.publicSignals.map(BigInt)

  const { result: isValid } = await tryMultipleRpcProviders(async (provider) => {
    const verifierContract = new ethers.Contract(verifierAddress, VERIFIER_ABI, provider)
    return verifierContract.verifyProof(proof.a, proof.b, proof.c, publicSignals)
  })

  return isValid
}

/**
 * Verify proof with detailed result
 *
 * Returns additional information useful for debugging and logging.
 */
export async function verifyStoredProofWithDetails(
  storedProof: SelfProofData,
  attestationId: number = 1,
): Promise<{
  isValid: boolean
  publicSignalsCount: number
  verifierAddress?: string
  rpcUrl?: string
  error?: string
}> {
  try {
    const verifierAddress = await getVerifierAddress(attestationId)

    // Convert proof to the format expected by the contract
    // Note: b coordinates need to be swapped
    const proof = {
      a: storedProof.proof.a.map(BigInt),
      b: [
        [BigInt(storedProof.proof.b[0][1]), BigInt(storedProof.proof.b[0][0])],
        [BigInt(storedProof.proof.b[1][1]), BigInt(storedProof.proof.b[1][0])],
      ],
      c: storedProof.proof.c.map(BigInt),
    }

    const publicSignals = storedProof.publicSignals.map(BigInt)

    const { result: isValid, rpcUrl } = await tryMultipleRpcProviders(async (provider) => {
      const verifierContract = new ethers.Contract(verifierAddress, VERIFIER_ABI, provider)
      return verifierContract.verifyProof(proof.a, proof.b, proof.c, publicSignals)
    })

    return {
      isValid,
      publicSignalsCount: storedProof.publicSignals.length,
      verifierAddress,
      rpcUrl,
    }
  } catch (error) {
    return {
      isValid: false,
      publicSignalsCount: storedProof.publicSignals.length,
      error: error instanceof Error ? error.message : "Unknown verification error",
    }
  }
}
