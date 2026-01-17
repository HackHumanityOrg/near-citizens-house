/**
 * Verification Contract Types
 *
 * Database interface for the verified-accounts smart contract.
 * All schemas are defined in lib/shared/schemas/.
 */
import type { VerificationDataWithSignature } from "../../schemas/contract"
import type { NearAccountId } from "../../schemas/near"
import type { VerificationSummary, Verification } from "../../schemas/selfxyz"
import type { Pagination } from "../../schemas/core"

// ============================================================================
// Verification Database Interface
// ============================================================================

/**
 * Paginated result from list operations.
 */
export interface PaginatedVerifications {
  accounts: Verification[]
  total: number
}

export interface IVerificationDatabase {
  isVerified(nearAccountId: NearAccountId): Promise<boolean>
  storeVerification(data: VerificationDataWithSignature): Promise<void>
  getVerification(nearAccountId: NearAccountId): Promise<VerificationSummary | null>
  getFullVerification(nearAccountId: NearAccountId): Promise<Verification | null>
  listVerifications(fromIndex?: number, limit?: number): Promise<PaginatedVerifications>
  listVerificationsNewestFirst(pagination?: Pagination): Promise<PaginatedVerifications>
}
