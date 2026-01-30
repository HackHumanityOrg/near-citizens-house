/**
 * Common API Response Schemas
 */
import { z } from "zod"

export const statusOkResponseSchema = z.object({
  status: z.literal("ok"),
  message: z.string(),
  timestamp: z.string(),
})

export type StatusOkResponse = z.infer<typeof statusOkResponseSchema>

export const webhookAckResponseSchema = z.object({
  status: z.literal("ok"),
  message: z.string(),
  accountId: z.string().optional(),
})

export type WebhookAckResponse = z.infer<typeof webhookAckResponseSchema>
