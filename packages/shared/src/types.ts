// Type definitions for Self.xyz and NEAR integration
// All types are defined as Zod schemas for runtime validation
import { z } from "zod"

// ============================================================================
// ZK Proof Schemas
// ============================================================================

// Groth16 ZK proof structure (a, b, c points)
export const zkProofSchema = z.object({
  a: z.tuple([z.string(), z.string()]),
  b: z.tuple([z.tuple([z.string(), z.string()]), z.tuple([z.string(), z.string()])]),
  c: z.tuple([z.string(), z.string()]),
})

export type ZkProof = z.infer<typeof zkProofSchema>

// Self.xyz proof data for async verification
export const selfProofDataSchema = z.object({
  proof: zkProofSchema,
  publicSignals: z.array(z.string()),
})

export type SelfProofData = z.infer<typeof selfProofDataSchema>

// ============================================================================
// NEAR Signature Schemas
// ============================================================================

// NEAR wallet signature data (NEP-413)
export const nearSignatureDataSchema = z.object({
  accountId: z.string(),
  signature: z.string(),
  publicKey: z.string(),
  challenge: z.string(),
  timestamp: z.number(),
  nonce: z.array(z.number()).length(32), // NEP-413 nonce (32 bytes)
  recipient: z.string(), // NEP-413 recipient
})

export type NearSignatureData = z.infer<typeof nearSignatureDataSchema>

// ============================================================================
// Verification Request/Response Schemas
// ============================================================================

// API request schema for verification endpoint
export const verifyRequestSchema = z.object({
  attestationId: z.union([z.literal("1"), z.literal("2"), z.literal("3"), z.literal(1), z.literal(2), z.literal(3)]),
  proof: zkProofSchema,
  publicSignals: z.array(z.string()),
  userContextData: z.string(),
})

export type VerifyRequest = z.infer<typeof verifyRequestSchema>

// Self.xyz verification result (API response) - discriminated union for type safety
export const selfVerificationResultSchema = z.discriminatedUnion("status", [
  // Success case - attestationId and userData are required
  z.object({
    status: z.literal("success"),
    result: z.literal(true),
    attestationId: z.string(),
    userData: z.object({
      userId: z.string(),
      nearAccountId: z.string(),
      nearSignature: z.string(),
    }),
    discloseOutput: z
      .object({
        nullifier: z.string().optional(), // Unique passport identifier for Sybil resistance
      })
      .catchall(z.unknown()) // Allow other fields from Self.xyz
      .optional(),
  }),
  // Error case - reason is required
  z.object({
    status: z.literal("error"),
    result: z.literal(false),
    reason: z.string(),
  }),
])

export type SelfVerificationResult = z.infer<typeof selfVerificationResultSchema>

// ============================================================================
// Database Schemas
// ============================================================================

// Base verification data
export const verificationDataSchema = z.object({
  nullifier: z.string(),
  nearAccountId: z.string(),
  userId: z.string(),
  attestationId: z.string(),
})

export type VerificationData = z.infer<typeof verificationDataSchema>

// Verification data with NEAR signature and Self proof for on-chain verification
export const verificationDataWithSignatureSchema = verificationDataSchema.extend({
  signatureData: nearSignatureDataSchema,
  selfProofData: selfProofDataSchema,
  userContextData: z.string(), // Original hex-encoded userContextData
})

export type VerificationDataWithSignature = z.infer<typeof verificationDataWithSignatureSchema>

// Verified account record (stored in database/contract)
export const verifiedAccountSchema = z.object({
  nullifier: z.string(), // Unique passport identifier (prevents duplicate registrations)
  nearAccountId: z.string(), // Associated NEAR wallet
  userId: z.string(),
  attestationId: z.string(),
  verifiedAt: z.number(),
  selfProof: selfProofDataSchema, // Self.xyz ZK proof for async verification
  userContextData: z.string(), // Original hex-encoded userContextData for Self.xyz re-verification
})

export type VerifiedAccount = z.infer<typeof verifiedAccountSchema>

// ============================================================================
// Discourse Integration Schemas
// ============================================================================

// Discourse user profile
export const discourseProfileSchema = z.object({
  username: z.string(),
  email: z.string().nullable(),
  avatar_url: z.string(),
  trust_level: z.number(),
  name: z.string().nullable(),
})

export type DiscourseProfile = z.infer<typeof discourseProfileSchema>

// Discourse authentication state
export const discourseAuthStateSchema = z.object({
  privateKeyPem: z.string(),
  nonce: z.string(),
  clientId: z.string(),
})

export type DiscourseAuthState = z.infer<typeof discourseAuthStateSchema>

// Discourse RSA key pair
export const keyPairSchema = z.object({
  privateKeyPem: z.string(),
  publicKeyPem: z.string(),
})

export type KeyPair = z.infer<typeof keyPairSchema>

// Decrypted Discourse payload
export const decryptedPayloadSchema = z.object({
  key: z.string(),
  nonce: z.string(),
  push: z.boolean().optional(),
  api: z.number().optional(),
})

export type DecryptedPayload = z.infer<typeof decryptedPayloadSchema>

// ============================================================================
// Verification Utility Schemas
// ============================================================================

// Parsed NEAR signature data from user context (subset of nearSignatureDataSchema)
export const parsedSignatureDataSchema = nearSignatureDataSchema.pick({
  accountId: true,
  signature: true,
  publicKey: true,
  nonce: true,
})

export type ParsedSignatureData = z.infer<typeof parsedSignatureDataSchema>

// Proof data for verification (combines nullifier, user info, and ZK proof)
export const proofDataSchema = z.object({
  nullifier: z.string(),
  userId: z.string(),
  attestationId: z.string(),
  verifiedAt: z.number(),
  zkProof: zkProofSchema,
  publicSignals: z.array(z.string()),
  signature: z.object({
    accountId: z.string(),
    publicKey: z.string(),
    signature: z.string(),
    nonce: z.string(), // base64 encoded 32-byte nonce
    challenge: z.string(),
    recipient: z.string(),
  }),
  userContextData: z.string(), // raw hex-encoded data
  nearSignatureVerification: z.object({
    nep413Hash: z.string(), // SHA-256 hash of NEP-413 formatted message (hex)
    publicKeyHex: z.string(), // Raw Ed25519 public key (hex)
    signatureHex: z.string(), // Signature in hex
  }),
})

export type ProofData = z.infer<typeof proofDataSchema>

// ============================================================================
// Contract Format Schemas (snake_case from Rust)
// ============================================================================
// These schemas validate contract responses and transform snake_case to camelCase

// Contract format for SelfProofData (with transform to app format)
export const contractSelfProofDataSchema = z
  .object({
    proof: zkProofSchema, // ZkProof fields don't have underscores
    public_signals: z.array(z.string()),
  })
  .transform((data) => ({
    proof: data.proof,
    publicSignals: data.public_signals,
  }))

// Contract format for VerifiedAccount (with transform to app format)
export const contractVerifiedAccountSchema = z
  .object({
    nullifier: z.string(),
    near_account_id: z.string(),
    user_id: z.string(),
    attestation_id: z.string(),
    verified_at: z.number(), // nanoseconds
    self_proof: z.object({
      proof: zkProofSchema,
      public_signals: z.array(z.string()),
    }),
    user_context_data: z.string(),
  })
  .transform((data) => ({
    nullifier: data.nullifier,
    nearAccountId: data.near_account_id,
    userId: data.user_id,
    attestationId: data.attestation_id,
    verifiedAt: Math.floor(data.verified_at / 1_000_000), // Convert nanoseconds to milliseconds
    selfProof: {
      proof: data.self_proof.proof,
      publicSignals: data.self_proof.public_signals,
    },
    userContextData: data.user_context_data,
  }))

export type ContractVerifiedAccount = z.input<typeof contractVerifiedAccountSchema>
export type TransformedVerifiedAccount = z.output<typeof contractVerifiedAccountSchema>

// ============================================================================
// Verification Database Interface
// ============================================================================

export interface IVerificationDatabase {
  isAccountVerified(nearAccountId: string): Promise<boolean>
  storeVerification(data: VerificationDataWithSignature): Promise<void>
  getVerifiedAccount(nearAccountId: string): Promise<VerifiedAccount | null>
  getAllVerifiedAccounts(): Promise<VerifiedAccount[]>
  getVerifiedAccounts(fromIndex?: number, limit?: number): Promise<{ accounts: VerifiedAccount[]; total: number }>
}

// ============================================================================
// Governance Schemas
// ============================================================================

// Vote choice enum
export const voteSchema = z.enum(["Yes", "No", "Abstain"])
export type Vote = z.infer<typeof voteSchema>

// Proposal status enum
export const proposalStatusSchema = z.enum(["Active", "Passed", "Failed", "QuorumNotMet", "Cancelled"])
export type ProposalStatus = z.infer<typeof proposalStatusSchema>

// Vote counts
export const voteCountsSchema = z.object({
  yesVotes: z.number(),
  noVotes: z.number(),
  abstainVotes: z.number(),
  totalVotes: z.number(),
})
export type VoteCounts = z.infer<typeof voteCountsSchema>

// Proposal domain type
export const proposalSchema = z.object({
  id: z.number(),
  title: z.string(),
  description: z.string(),
  proposer: z.string(),
  discourseUrl: z.string().nullable(),
  createdAt: z.number(), // milliseconds
  votingEndsAt: z.number(), // milliseconds
  status: proposalStatusSchema,
  quorumPercentage: z.number(), // 1-100
})
export type Proposal = z.infer<typeof proposalSchema>

// Proposal with vote statistics
export const proposalWithStatsSchema = z.object({
  proposal: proposalSchema,
  voteCounts: voteCountsSchema,
  quorumRequired: z.number(),
  totalCitizens: z.number(),
  userVote: voteSchema.nullable().optional(),
})
export type ProposalWithStats = z.infer<typeof proposalWithStatsSchema>

// Contract format for VoteCounts (with transform to camelCase)
export const contractVoteCountsSchema = z
  .object({
    yes_votes: z.number(),
    no_votes: z.number(),
    abstain_votes: z.number(),
    total_votes: z.number(),
  })
  .transform((data) => ({
    yesVotes: data.yes_votes,
    noVotes: data.no_votes,
    abstainVotes: data.abstain_votes,
    totalVotes: data.total_votes,
  }))

// Contract format for Proposal (with transform to camelCase and time conversion)
export const contractProposalSchema = z
  .object({
    id: z.number(),
    title: z.string(),
    description: z.string(),
    proposer: z.string(),
    discourse_url: z.string().nullable(),
    created_at: z.number(), // nanoseconds
    voting_ends_at: z.number(), // nanoseconds
    status: z.string(),
    quorum_percentage: z.number(), // 1-100
  })
  .transform((data) => ({
    id: data.id,
    title: data.title,
    description: data.description,
    proposer: data.proposer,
    discourseUrl: data.discourse_url,
    createdAt: Math.floor(data.created_at / 1_000_000), // nanoseconds → milliseconds
    votingEndsAt: Math.floor(data.voting_ends_at / 1_000_000), // nanoseconds → milliseconds
    status: data.status as ProposalStatus,
    quorumPercentage: data.quorum_percentage,
  }))

export type ContractProposal = z.input<typeof contractProposalSchema>
export type TransformedProposal = z.output<typeof contractProposalSchema>

// API request schemas
export const createProposalRequestSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(10000),
  discourseUrl: z
    .string()
    .max(500)
    .optional()
    .transform((val) => (val === "" ? undefined : val))
    .refine((val) => !val || /^https?:\/\/.+/.test(val), {
      message: "Must be a valid URL",
    }),
  quorumPercentage: z.number().int().min(1).max(100),
})
export type CreateProposalRequest = z.infer<typeof createProposalRequestSchema>

export const voteRequestSchema = z.object({
  proposalId: z.number(),
  vote: voteSchema,
})
export type VoteRequest = z.infer<typeof voteRequestSchema>

// Governance parameters from contract
export const governanceParametersSchema = z.object({
  votingPeriodDays: z.number(),
  quorumPercentageMin: z.number(),
  quorumPercentageMax: z.number(),
  quorumPercentageDefault: z.number(),
})
export type GovernanceParameters = z.infer<typeof governanceParametersSchema>

// Contract format for GovernanceParameters (snake_case)
export const contractGovernanceParametersSchema = z
  .object({
    voting_period_days: z.number(),
    quorum_percentage_min: z.number(),
    quorum_percentage_max: z.number(),
    quorum_percentage_default: z.number(),
  })
  .transform((data) => ({
    votingPeriodDays: data.voting_period_days,
    quorumPercentageMin: data.quorum_percentage_min,
    quorumPercentageMax: data.quorum_percentage_max,
    quorumPercentageDefault: data.quorum_percentage_default,
  }))

// ============================================================================
// Governance Database Interface (Read-Only)
// ============================================================================

/**
 * Read-only interface for governance contract queries.
 * Write operations (createProposal, vote, etc.) are handled client-side
 * via the useGovernance hook with user wallet signing.
 */
export interface IGovernanceDatabase {
  getProposal(proposalId: number): Promise<Proposal | null>
  getProposals(from: number, limit: number, status?: ProposalStatus): Promise<Proposal[]>
  getVote(proposalId: number, accountId: string): Promise<Vote | null>
  hasVoted(proposalId: number, accountId: string): Promise<boolean>
  getVoteCounts(proposalId: number): Promise<VoteCounts>
  getProposalCount(): Promise<number>
  getParameters(): Promise<GovernanceParameters>
}
