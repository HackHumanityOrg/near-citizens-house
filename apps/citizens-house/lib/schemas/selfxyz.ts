/**
 * Self.xyz Schemas
 *
 * Attestation IDs, ZK proofs, public signals, verification records, and SDK response types.
 * Based on @selfxyz/core SDK.
 */
import { z } from "zod"
import { SIZE_LIMITS } from "./core"
import { nearAccountIdSchema } from "./near"

export const ATTESTATION_ID = {
  PASSPORT: 1,
  BIOMETRIC_ID_CARD: 2,
  AADHAAR: 3,
} as const

export const attestationIdSchema = z
  .union([z.literal(1), z.literal(2), z.literal(3)])
  .describe("Attestation ID (1, 2, or 3)")

export type AttestationId = z.infer<typeof attestationIdSchema>

/** Public signals count per attestation type. */
export const PUBLIC_SIGNALS_COUNT: Record<AttestationId, number> = {
  1: 21,
  2: 21,
  3: 19,
} as const

export const MAX_PUBLIC_SIGNALS_COUNT = 21

export const proofComponentSchema = z.string().max(SIZE_LIMITS.PROOF_COMPONENT)

/** Groth16 ZK proof structure (a, b, c points). */
export const zkProofSchema = z.object({
  a: z.tuple([proofComponentSchema, proofComponentSchema]),
  b: z.tuple([
    z.tuple([proofComponentSchema, proofComponentSchema]),
    z.tuple([proofComponentSchema, proofComponentSchema]),
  ]),
  c: z.tuple([proofComponentSchema, proofComponentSchema]),
})

export type ZkProof = z.infer<typeof zkProofSchema>

export const publicSignalsSchema = z.array(proofComponentSchema).max(MAX_PUBLIC_SIGNALS_COUNT)

export type PublicSignals = z.infer<typeof publicSignalsSchema>

export function getPublicSignalsSchema(attestationId: AttestationId) {
  const expectedCount = PUBLIC_SIGNALS_COUNT[attestationId]
  return z
    .array(proofComponentSchema)
    .length(expectedCount, `Attestation ${attestationId} requires exactly ${expectedCount} public signals`)
}

export const selfProofDataSchema = z.object({
  proof: zkProofSchema,
  publicSignals: publicSignalsSchema,
})

export type SelfProofData = z.infer<typeof selfProofDataSchema>

export const verifyRequestSchema = z.object({
  attestationId: attestationIdSchema,
  proof: zkProofSchema,
  publicSignals: publicSignalsSchema,
  userContextData: z.string().max(SIZE_LIMITS.USER_CONTEXT_DATA),
})

export type VerifyRequest = z.infer<typeof verifyRequestSchema>

export const nullifierSchema = z.string().max(SIZE_LIMITS.NULLIFIER)

export type Nullifier = z.infer<typeof nullifierSchema>

/** NEAR signature data embedded in Self.xyz userDefinedData. */
export const userDefinedDataSchema = z.object({
  accountId: nearAccountIdSchema,
  signature: z.string(),
  publicKey: z.string(),
  nonce: z.string(),
  timestamp: z.number().optional(),
})

export type UserDefinedData = z.infer<typeof userDefinedDataSchema>

/** Parse userDefinedData from Self.xyz to extract signature JSON. */
export function parseUserDefinedDataRaw(userDefinedDataRaw: unknown): string | null {
  if (!userDefinedDataRaw) return null

  let jsonString = ""

  if (typeof userDefinedDataRaw === "string") {
    if (userDefinedDataRaw.length % 2 === 0 && /^[0-9a-fA-F]+$/.test(userDefinedDataRaw)) {
      jsonString = Buffer.from(userDefinedDataRaw, "hex").toString("utf8")
    } else {
      jsonString = userDefinedDataRaw
    }
  } else if (Array.isArray(userDefinedDataRaw)) {
    jsonString = new TextDecoder().decode(new Uint8Array(userDefinedDataRaw))
  } else if (typeof userDefinedDataRaw === "object" && userDefinedDataRaw !== null) {
    const values = Object.values(userDefinedDataRaw)
    if (values.every((v) => typeof v === "number")) {
      jsonString = new TextDecoder().decode(new Uint8Array(values as number[]))
    }
  }

  if (!jsonString) return null

  jsonString = jsonString.replace(/\0/g, "")

  const firstBrace = jsonString.indexOf("{")
  const lastBrace = jsonString.lastIndexOf("}")
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return jsonString.substring(firstBrace, lastBrace + 1)
  }

  return jsonString
}

// SDK Response Types (plain interfaces, not runtime-validated)

export interface SelfIsValidDetails {
  isValid: boolean
  isMinimumAgeValid: boolean
  isOfacValid: boolean
}

export interface SelfDiscloseOutput {
  nullifier: string
  nationality?: string
  minimumAge?: string
  gender?: string
  [key: string]: unknown
}

export interface SelfUserData {
  userIdentifier: string
  userDefinedData: string
}

export interface SelfVerificationResult {
  attestationId: AttestationId
  isValidDetails: SelfIsValidDetails
  forbiddenCountriesList: string[]
  discloseOutput: SelfDiscloseOutput
  userData: SelfUserData
}

// Self.xyz SDK Response Validation Schemas
// Runtime validation for external SDK boundary

const selfIsValidDetailsSchema = z.object({
  isValid: z.boolean(),
  isMinimumAgeValid: z.boolean().optional(),
  isOfacValid: z.boolean().optional(),
})

const selfDiscloseOutputSchema = z.looseObject({
  nullifier: z.string().min(1),
  nationality: z.string().optional(),
})

const selfUserDataSchema = z.object({
  userIdentifier: z.string(),
  userDefinedData: z.union([z.string(), z.array(z.number()), z.record(z.string(), z.number())]),
})

export const selfVerificationResultSchema = z.object({
  attestationId: attestationIdSchema,
  isValidDetails: selfIsValidDetailsSchema,
  forbiddenCountriesList: z.array(z.string()).default([]),
  discloseOutput: selfDiscloseOutputSchema,
  userData: selfUserDataSchema,
})

// Verification Record Schemas (combine Self.xyz + NEAR data)

export const verificationDataSchema = z.object({
  nullifier: nullifierSchema,
  nearAccountId: nearAccountIdSchema,
  attestationId: attestationIdSchema,
})

export type VerificationData = z.infer<typeof verificationDataSchema>

export const verificationSummarySchema = z.object({
  nullifier: nullifierSchema,
  nearAccountId: nearAccountIdSchema,
  attestationId: attestationIdSchema,
  verifiedAt: z.number(),
})

export type VerificationSummary = z.output<typeof verificationSummarySchema>

export const verificationSchema = z.object({
  nullifier: nullifierSchema,
  nearAccountId: nearAccountIdSchema,
  attestationId: attestationIdSchema,
  verifiedAt: z.number(),
  selfProof: selfProofDataSchema,
  userContextData: z.string().max(SIZE_LIMITS.USER_CONTEXT_DATA),
})

export type Verification = z.output<typeof verificationSchema>
