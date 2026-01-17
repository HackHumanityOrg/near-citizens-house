/**
 * Central Schema Hub
 *
 * All Zod schemas consolidated in one location.
 * Import from '@/lib/shared/schemas' or specific modules for tree-shaking.
 */

// Core schemas (SIZE_LIMITS, attestation IDs, pagination)
export * from "./core"

// Error schemas (error codes, messages, helpers)
export * from "./errors"

// NEAR schemas (account IDs, signatures, NEP-413)
export * from "./near"

// Session schemas (Redis session storage)
export * from "./session"

// API response schemas (verify, status endpoints)
export * from "./api"

// ZK proof schemas (Groth16, Self.xyz proof data)
export * from "./zk-proof"

// Contract schemas (snake_case transforms, database types)
export * from "./contract"

// Environment variable schemas
export * from "./env"

// UI schemas (verification steps, status)
export * from "./ui"
