/**
 * Governance Transaction Builders (Client-safe)
 *
 * Each function returns a SignAndSendTransactionParams-compatible object
 * for use with signAndSendTransaction() from the wallet provider.
 * All contract writes are done via the user's wallet, not a backend key.
 */
import type { SignAndSendTransactionParams } from "@hot-labs/near-connect"
import { NEAR_CONFIG } from "../../config"
import type { VoteChoice } from "../../schemas/governance-contract"
import { GAS_100_TGAS } from "../gas"

const ONE_YOCTO = "1"
const ZERO_DEPOSIT = "0"

function getContractId(): string {
  const contractId = NEAR_CONFIG.governanceContractId
  if (!contractId) throw new Error("Proposals contract not configured")
  return contractId
}

function buildFunctionCallTx(
  methodName: string,
  args: Record<string, unknown>,
  deposit: string,
  gas: string = GAS_100_TGAS,
): SignAndSendTransactionParams {
  return {
    receiverId: getContractId(),
    actions: [{ type: "FunctionCall", params: { methodName, args, gas, deposit } }],
  }
}

// =============================================================================
// Voting
// =============================================================================

export function buildCastVoteTx(
  proposalId: number,
  choice: VoteChoice,
  deposit?: string,
): SignAndSendTransactionParams {
  return buildFunctionCallTx("cast_vote", { proposal_id: proposalId, choice }, deposit ?? ZERO_DEPOSIT)
}

// =============================================================================
// Proposal Lifecycle
// =============================================================================

export function buildCreateProposalTx(
  title: string,
  author: string,
  description: string,
  bond: string,
  startAt?: string,
): SignAndSendTransactionParams {
  const args: Record<string, unknown> = { title, author, description }
  if (startAt) args.start_at = startAt
  return buildFunctionCallTx("create_proposal", args, bond)
}

export function buildCancelProposalTx(proposalId: number): SignAndSendTransactionParams {
  return buildFunctionCallTx("cancel_proposal", { proposal_id: proposalId }, ONE_YOCTO)
}

export function buildExpirePendingProposalTx(proposalId: number): SignAndSendTransactionParams {
  return buildFunctionCallTx("expire_pending_proposal", { proposal_id: proposalId }, ONE_YOCTO)
}

export function buildFinalizeProposalTx(proposalId: number): SignAndSendTransactionParams {
  return buildFunctionCallTx("finalize_proposal", { proposal_id: proposalId }, ZERO_DEPOSIT)
}

// =============================================================================
// Blocklist
// =============================================================================

export function buildBlocklistAccountTx(accountId: string): SignAndSendTransactionParams {
  return buildFunctionCallTx("blocklist_account", { account_id: accountId }, ONE_YOCTO)
}

export function buildUnblocklistAccountTx(accountId: string): SignAndSendTransactionParams {
  return buildFunctionCallTx("unblocklist_account", { account_id: accountId }, ONE_YOCTO)
}

// =============================================================================
// Admin Management
// =============================================================================

export function buildAddAdminTx(accountId: string): SignAndSendTransactionParams {
  return buildFunctionCallTx("add_admin", { account_id: accountId }, ONE_YOCTO)
}

export function buildRemoveAdminTx(accountId: string): SignAndSendTransactionParams {
  return buildFunctionCallTx("remove_admin", { account_id: accountId }, ONE_YOCTO)
}

// =============================================================================
// Configuration Updates
// =============================================================================

export function buildUpdateQuorumBpsTx(newBps: number): SignAndSendTransactionParams {
  return buildFunctionCallTx("update_quorum_bps", { new_bps: newBps }, ONE_YOCTO)
}

export function buildUpdateVotingPeriodSecsTx(newPeriodSecs: number): SignAndSendTransactionParams {
  return buildFunctionCallTx("update_voting_period_secs", { new_period_secs: newPeriodSecs }, ONE_YOCTO)
}

export function buildUpdatePendingExpirySecsTx(newPeriodSecs: number): SignAndSendTransactionParams {
  return buildFunctionCallTx("update_pending_expiry_secs", { new_period_secs: newPeriodSecs }, ONE_YOCTO)
}

export function buildUpdateMinProposalBondTx(newMinYocto: string): SignAndSendTransactionParams {
  return buildFunctionCallTx("update_min_proposal_bond", { new_min: newMinYocto }, ONE_YOCTO)
}

export function buildUpdateFinalizeGracePeriodSecsTx(newPeriodSecs: number): SignAndSendTransactionParams {
  return buildFunctionCallTx("update_finalize_grace_period_secs", { new_period_secs: newPeriodSecs }, ONE_YOCTO)
}

export function buildUpdateMaxStartDelaySecsTx(newPeriodSecs: number): SignAndSendTransactionParams {
  return buildFunctionCallTx("update_max_start_delay_secs", { new_period_secs: newPeriodSecs }, ONE_YOCTO)
}

export function buildUpdateVerifiedAccountsContractTx(newContract: string): SignAndSendTransactionParams {
  return buildFunctionCallTx("update_verified_accounts_contract", { new_contract: newContract }, ONE_YOCTO)
}

// =============================================================================
// Recovery
// =============================================================================

export function buildClearStalePendingVoteTx(proposalId: number, accountId: string): SignAndSendTransactionParams {
  return buildFunctionCallTx("clear_stale_pending_vote", { proposal_id: proposalId, account_id: accountId }, ONE_YOCTO)
}

export function buildClearStaleBlocklistOpTx(): SignAndSendTransactionParams {
  return buildFunctionCallTx("clear_stale_blocklist_op", {}, ONE_YOCTO)
}
