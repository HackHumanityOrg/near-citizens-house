// Type definitions for Self.xyz and NEAR integration

export interface SelfVerificationResult {
  status: "success" | "error"
  result: boolean
  reason?: string
  attestationId?: string
  userData?: {
    userId: string
    nearAccountId: string
    nearSignature: string
  }
  discloseOutput?: {
    nullifier?: string // Unique passport identifier for Sybil resistance
    // Other fields may be present based on Self.xyz configuration
    [key: string]: unknown
  }
}

export interface NearSignatureData {
  accountId: string
  signature: string
  publicKey: string
  challenge: string
  timestamp: number
  nonce: number[] // NEP-413 nonce (32 bytes)
  recipient: string // NEP-413 recipient
}

// Groth16 ZK proof structure (a, b, c points)
export interface ZkProof {
  a: [string, string]
  b: [[string, string], [string, string]]
  c: [string, string]
}

// Self.xyz proof data for async verification
export interface SelfProofData {
  proof: ZkProof
  publicSignals: string[]
}

export interface VerificationStep {
  id: string
  title: string
  description: string
  status: "pending" | "active" | "complete" | "error"
}
