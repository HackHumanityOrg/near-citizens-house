/**
 * Verification Domain Schemas
 *
 * Internal status record stored in Redis and mapped to API responses.
 */
import { z } from "zod"
import { verificationStatusErrorCodeSchema } from "../errors"

export type VerificationStatusErrorCode = z.infer<typeof verificationStatusErrorCodeSchema>

export const verificationStatusDetailsSchema = z.object({
  rejectLabels: z.array(z.string()).optional(),
  moderationComment: z.string().optional(),
})

export const verificationStatusRecordSchema = z.object({
  state: z.enum(["hold", "failed"]),
  updatedAt: z.number(),
  errorCode: verificationStatusErrorCodeSchema,
  details: verificationStatusDetailsSchema.optional(),
})

export type VerificationStatusRecord = z.infer<typeof verificationStatusRecordSchema>
