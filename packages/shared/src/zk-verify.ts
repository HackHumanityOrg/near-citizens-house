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
import type { SelfProofData } from "./types"

export type { SelfProofData as StoredProofData }

// Self.xyz IdentityVerificationHub addresses
const IDENTITY_VERIFICATION_HUB_MAINNET = "0xe57F4773bd9c9d8b6Cd70431117d353298B9f5BF"
const IDENTITY_VERIFICATION_HUB_TESTNET = "0x16ECBA51e18a4a7e61fdC417f0d47AFEeDfbed74"

// Get configuration from environment or use defaults
const USE_MOCK_PASSPORT = process.env.SELF_USE_MOCK_PASSPORT === "true"
const CELO_RPC_URL =
  process.env.CELO_RPC_URL || (USE_MOCK_PASSPORT ? "https://alfajores-forno.celo-testnet.org" : "https://1rpc.io/celo")
const IDENTITY_VERIFICATION_HUB_ADDRESS = USE_MOCK_PASSPORT
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

/**
 * Get the verifier contract address from the hub
 */
async function getVerifierAddress(provider: ethers.JsonRpcProvider, attestationId: number): Promise<string> {
  if (cachedVerifierAddress) {
    return cachedVerifierAddress
  }

  const hubContract = new ethers.Contract(IDENTITY_VERIFICATION_HUB_ADDRESS, HUB_ABI, provider)

  // Convert attestationId to bytes32 format
  const attestationIdBytes32 = "0x" + attestationId.toString(16).padStart(64, "0")
  const verifierAddress = await hubContract.discloseVerifier(attestationIdBytes32)

  if (verifierAddress === "0x0000000000000000000000000000000000000000") {
    throw new Error("Verifier contract not found for attestation ID: " + attestationId)
  }

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
  const provider = new ethers.JsonRpcProvider(CELO_RPC_URL)
  const verifierAddress = await getVerifierAddress(provider, attestationId)
  const verifierContract = new ethers.Contract(verifierAddress, VERIFIER_ABI, provider)

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

  return verifierContract.verifyProof(proof.a, proof.b, proof.c, publicSignals)
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
  error?: string
}> {
  try {
    const provider = new ethers.JsonRpcProvider(CELO_RPC_URL)
    const verifierAddress = await getVerifierAddress(provider, attestationId)
    const verifierContract = new ethers.Contract(verifierAddress, VERIFIER_ABI, provider)

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
    const isValid = await verifierContract.verifyProof(proof.a, proof.b, proof.c, publicSignals)

    return {
      isValid,
      publicSignalsCount: storedProof.publicSignals.length,
      verifierAddress,
    }
  } catch (error) {
    return {
      isValid: false,
      publicSignalsCount: storedProof.publicSignals.length,
      error: error instanceof Error ? error.message : "Unknown verification error",
    }
  }
}
