/**
 * Core Schemas - Size limits and pagination.
 */
import { z } from "zod"

/** Size limits for verification data. Must match the Rust contract constants. */
export const SIZE_LIMITS = {
  NULLIFIER: 80,
  ATTESTATION_ID: 1,
  USER_CONTEXT_DATA: 4096,
  PROOF_COMPONENT: 80,
  MAX_BATCH_SIZE: 100,
} as const

export const paginationSchema = z.object({
  page: z.number().int().min(0).max(100000),
  pageSize: z.number().int().min(1).max(SIZE_LIMITS.MAX_BATCH_SIZE),
})

export type Pagination = z.infer<typeof paginationSchema>
