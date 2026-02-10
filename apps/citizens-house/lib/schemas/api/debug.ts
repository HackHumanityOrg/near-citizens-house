import { z } from "zod"

export const debugForceVerifyResponseSchema = z.object({
  success: z.boolean(),
  error: z.string().optional(),
})

export type DebugForceVerifyResponse = z.infer<typeof debugForceVerifyResponseSchema>
