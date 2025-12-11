/**
 * Sputnik Bridge Contract Types
 *
 * Zod schemas and TypeScript types for the sputnik-bridge smart contract.
 */
import { z } from "zod"

// ============================================================================
// Bridge Info Schemas
// ============================================================================

/**
 * Raw contract response format (snake_case)
 * Using strictObject to fail if contract adds new fields
 */
export const contractBridgeInfoSchema = z.strictObject({
  backend_wallet: z.string(),
  sputnik_dao: z.string(),
  verified_accounts_contract: z.string(),
  citizen_role: z.string(),
})

export type ContractBridgeInfo = z.input<typeof contractBridgeInfoSchema>

/**
 * Transformed schema (camelCase) for application use
 */
export const bridgeInfoSchema = contractBridgeInfoSchema.transform((data) => ({
  backendWallet: data.backend_wallet,
  sputnikDao: data.sputnik_dao,
  verifiedAccountsContract: data.verified_accounts_contract,
  citizenRole: data.citizen_role,
}))

export type BridgeInfo = z.output<typeof bridgeInfoSchema>

// ============================================================================
// Bridge Contract Interface
// ============================================================================

/**
 * Interface for bridge contract read operations
 */
export interface IBridgeContractReader {
  /**
   * Get bridge contract info
   */
  getInfo(): Promise<BridgeInfo>

  /**
   * Get the backend wallet address
   */
  getBackendWallet(): Promise<string>

  /**
   * Get the SputnikDAO contract address
   */
  getSputnikDao(): Promise<string>

  /**
   * Get the verified accounts contract address
   */
  getVerifiedAccountsContract(): Promise<string>

  /**
   * Get the citizen role name
   */
  getCitizenRole(): Promise<string>
}
