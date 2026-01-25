/**
 * Signature Verification Display Schema
 */
import { z } from "zod"
import { nearAccountIdSchema } from "./near"

export const signatureVerificationDataSchema = z.object({
  nep413Hash: z.string(),
  publicKeyHex: z.string(),
  signatureHex: z.string(),
  challenge: z.string(),
  recipient: z.string(),
  accountId: nearAccountIdSchema,
})

export type SignatureVerificationData = z.infer<typeof signatureVerificationDataSchema>
