/**
 * Governance Contract Types
 *
 * Read-only interface for the governance smart contract.
 * All schemas are defined in lib/schemas/governance-contract.ts.
 */
import type { ProposalView, VoteView, GovernanceConfig } from "../../schemas/governance-contract"
import type { Pagination } from "../../schemas/core"

export type { ProposalView, VoteView, GovernanceConfig }

export interface PaginatedProposals {
  proposals: ProposalView[]
  total: number
}

export interface IGovernanceReader {
  getProposal(proposalId: number): Promise<ProposalView | null>
  listProposals(fromIndex: number, limit: number): Promise<ProposalView[]>
  getProposalCount(): Promise<number>
  listProposalsNewestFirst(pagination?: Pagination): Promise<PaginatedProposals>
  getVote(proposalId: number, accountId: string): Promise<VoteView | null>
  hasVoted(proposalId: number, accountId: string): Promise<boolean>
  listVotes(proposalId: number, fromIndex: number, limit: number): Promise<VoteView[]>
  isAdmin(accountId: string): Promise<boolean>
  listAdmins(fromIndex: number, limit: number): Promise<string[]>
  isBlocklisted(accountId: string): Promise<boolean>
  listBlocklist(fromIndex: number, limit: number): Promise<string[]>
  isBlocklistLocked(): Promise<boolean>
  getConfig(): Promise<GovernanceConfig>
  isVoteFree(): Promise<boolean>
  getPendingVotesCount(proposalId: number): Promise<number>
}
