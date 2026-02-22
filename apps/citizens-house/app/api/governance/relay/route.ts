/**
 * NEP-366 Meta-Transaction Relayer for Gasless Governance Voting
 *
 * Accepts a base64-encoded SignedDelegate from zero-balance voters,
 * validates it, and submits a wrapping transaction using the backend key pool.
 * The NEAR runtime unwraps the DelegateAction so predecessor_account_id = voter.
 */
import * as Sentry from "@sentry/nextjs"
import { revalidateTag } from "next/cache"
import { type NextRequest, NextResponse } from "next/server"
import { deserialize } from "borsh"
import { PublicKey, KeyType } from "@near-js/crypto"
import { sha256 } from "@noble/hashes/sha2.js"
import {
  SCHEMA,
  actionCreators,
  encodeDelegateAction,
  type DelegateAction,
  type Signature,
} from "@near-js/transactions"
import type { Provider } from "@near-js/providers"
import { NEAR_CONFIG } from "@/lib/config"
import { NEAR_SERVER_CONFIG } from "@/lib/config.server"
import { backendKeyPool, setBackendKeyPoolRedis } from "@/lib/backend-key-pool"
import { getRedisClient } from "@/lib/redis"
import { createRpcProvider } from "@/lib/providers/rpc-provider"
import { governanceReader } from "@/lib/contracts/governance/client"
import { GAS_100_TGAS_BIGINT, GAS_120_TGAS_BIGINT } from "@/lib/contracts/gas"
import {
  castVoteArgsSchema,
  contractConfigSchema,
  contractProposalViewSchema,
  MAX_SIGNED_DELEGATE_BYTES,
  relayRequestSchema,
} from "@/lib/schemas/governance-contract"
import {
  getVoteRejectionReasonMessage,
  resolveGovernanceVoteOutcome,
  type VoteRejectionReason,
} from "@/lib/contracts/governance/vote-outcome"
import {
  nearAccessKeyResponseSchema,
  nearAccountIdSchema,
  type NearAccessKeyPermission,
  type NearAccountId,
} from "@/lib/schemas/near"
import { contractVerificationSummarySchema } from "@/lib/schemas/verification-contract"
import { withObservability } from "@/lib/api/with-observability"
import { extractPostHogContext } from "@/lib/api/request-context"
import { trackServerEvent, type TrackServerEventOptions } from "@/lib/analytics-server"
import type { AnalyticsEvent } from "@/lib/schemas/analytics"
import { getGovernanceInvalidationTags } from "@/lib/cache/rpc-tags"

const RATE_LIMIT_TTL = 60 // 1 relay per voter per minute
const MAX_BLOCK_HEIGHT_WINDOW = 500
const MIN_CAST_VOTE_GAS = GAS_100_TGAS_BIGINT
const MAX_CAST_VOTE_GAS = GAS_120_TGAS_BIGINT

// Initialize Redis for backend key pool
let redisInitialized = false
async function ensureRedisInitialized(): Promise<void> {
  if (redisInitialized) return
  const redis = await getRedisClient()
  setBackendKeyPoolRedis({ incr: (key: string) => redis.incr(key) })
  redisInitialized = true
}

/**
 * Deserialized DelegateAction shape from borsh v2.
 * Borsh v2 returns plain objects, not class instances.
 */
interface DeserializedFunctionCall {
  methodName: string
  args: Uint8Array
  gas: bigint
  deposit: bigint
}

interface DeserializedDelegateAction {
  senderId: string
  receiverId: string
  actions: Array<Record<string, unknown>>
  nonce: bigint
  maxBlockHeight: bigint
  publicKey: Record<string, unknown>
}

interface DeserializedSignedDelegate {
  delegateAction: DeserializedDelegateAction
  signature: Record<string, unknown>
}

interface ParsedKeyData {
  keyType: KeyType
  data: Uint8Array
}

type JsonObject = Record<string, unknown>
type GovernanceRelayValidationReason = Extract<
  AnalyticsEvent,
  { domain: "governance"; action: "relay_validation_fail" }
>["reason"]

function relayError(message: string, status = 400, reason?: VoteRejectionReason | "unknown") {
  return NextResponse.json(reason ? { error: message, reason } : { error: message }, { status })
}

function parsePublicKey(publicKey: Record<string, unknown>): ParsedKeyData | null {
  if (!publicKey || typeof publicKey !== "object") return null

  if ("ed25519Key" in publicKey) {
    const key = (publicKey as { ed25519Key?: { data?: unknown } }).ed25519Key
    const data = key?.data
    if (data instanceof Uint8Array) return { keyType: KeyType.ED25519, data }
    if (Array.isArray(data)) return { keyType: KeyType.ED25519, data: Uint8Array.from(data) }
  }

  if ("secp256k1Key" in publicKey) {
    const key = (publicKey as { secp256k1Key?: { data?: unknown } }).secp256k1Key
    const data = key?.data
    if (data instanceof Uint8Array) return { keyType: KeyType.SECP256K1, data }
    if (Array.isArray(data)) return { keyType: KeyType.SECP256K1, data: Uint8Array.from(data) }
  }

  return null
}

function parseSignature(signature: Record<string, unknown>): ParsedKeyData | null {
  if (!signature || typeof signature !== "object") return null

  if ("ed25519Signature" in signature) {
    const sig = (signature as { ed25519Signature?: { data?: unknown } }).ed25519Signature
    const data = sig?.data
    if (data instanceof Uint8Array) return { keyType: KeyType.ED25519, data }
    if (Array.isArray(data)) return { keyType: KeyType.ED25519, data: Uint8Array.from(data) }
  }

  if ("secp256k1Signature" in signature) {
    const sig = (signature as { secp256k1Signature?: { data?: unknown } }).secp256k1Signature
    const data = sig?.data
    if (data instanceof Uint8Array) return { keyType: KeyType.SECP256K1, data }
    if (Array.isArray(data)) return { keyType: KeyType.SECP256K1, data: Uint8Array.from(data) }
  }

  return null
}

function parseCastVoteArgs(args: unknown): { proposalId: number } | null {
  const argsBytes =
    args instanceof Uint8Array
      ? args
      : Array.isArray(args) && args.every((value) => typeof value === "number")
        ? Uint8Array.from(args)
        : null

  if (!argsBytes) return null

  try {
    const parsedJson = JSON.parse(Buffer.from(argsBytes).toString("utf-8"))
    const parsedArgs = castVoteArgsSchema.safeParse(parsedJson)
    if (!parsedArgs.success) return null
    return { proposalId: parsedArgs.data.proposal_id }
  } catch {
    return null
  }
}

function isAccessKeyPermissionAllowed(
  permission: NearAccessKeyPermission,
  receiverId: string,
  methodName: string,
): boolean {
  if (permission === "FullAccess") return true
  if (typeof permission === "object" && "FullAccess" in permission) return true

  if (typeof permission === "object" && "FunctionCall" in permission) {
    const { receiver_id, method_names } = permission.FunctionCall
    if (receiver_id !== receiverId) return false
    if (method_names.length === 0) return true
    return method_names.includes(methodName)
  }

  return false
}

async function verifyAccessKeyPermission(
  provider: Provider,
  accountId: NearAccountId,
  publicKey: string,
  receiverId: string,
  methodName: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const rawResponse = await provider.query({
      request_type: "view_access_key",
      finality: "final",
      account_id: accountId,
      public_key: publicKey,
    })

    const parseResult = nearAccessKeyResponseSchema.safeParse(rawResponse)
    if (!parseResult.success) {
      return { ok: false, error: "Invalid access key response from RPC" }
    }

    if (!isAccessKeyPermissionAllowed(parseResult.data.permission, receiverId, methodName)) {
      return { ok: false, error: "Access key does not allow this action" }
    }

    return { ok: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"

    if (message.includes("does not exist") || message.includes("UnknownAccessKey")) {
      return { ok: false, error: "Public key not found for account" }
    }
    if (message.includes("UnknownAccount")) {
      return { ok: false, error: "Account not found" }
    }

    return { ok: false, error: `RPC error: ${message}` }
  }
}

export const POST = withObservability({ route: "POST /api/governance/relay" }, async (request: NextRequest, log) => {
  let validatedAccountId: NearAccountId | undefined
  let relayProposalId: number | undefined
  const posthogContext = extractPostHogContext(request)
  const trackingOptions: TrackServerEventOptions = { sessionId: posthogContext.sessionId }

  log.setAll({
    has_posthog_session_id: Boolean(posthogContext.sessionId),
    has_posthog_distinct_id: Boolean(posthogContext.distinctId),
  })

  const trackRelayValidationFailure = async (
    reason: GovernanceRelayValidationReason,
    statusCode: number,
    options?: {
      errorMessage?: string
      voteRejectionReason?: VoteRejectionReason
      proposalId?: number
    },
  ): Promise<void> => {
    await trackServerEvent(
      validatedAccountId ?? "anonymous",
      {
        domain: "governance",
        action: "relay_validation_fail",
        reason,
        statusCode,
        accountId: validatedAccountId,
        proposalId: options?.proposalId ?? relayProposalId,
        voteRejectionReason: options?.voteRejectionReason,
        errorMessage: options?.errorMessage,
      },
      trackingOptions,
    )
  }

  const relayValidationError = async (
    reason: GovernanceRelayValidationReason,
    message: string,
    status = 400,
    voteRejectionReason?: VoteRejectionReason,
    options?: {
      proposalId?: number
    },
  ) => {
    await trackRelayValidationFailure(reason, status, {
      errorMessage: message,
      voteRejectionReason,
      proposalId: options?.proposalId,
    })
    return relayError(message, status, voteRejectionReason)
  }

  const trackRelaySubmissionResult = async (
    outcome: "success" | "tx_failed",
    options: { txHash?: string; errorMessage?: string; proposalId?: number },
  ): Promise<void> => {
    if (!validatedAccountId) return
    const proposalId = options.proposalId ?? relayProposalId
    if (proposalId === undefined) return

    await trackServerEvent(
      validatedAccountId,
      {
        domain: "governance",
        action: "relay_submission_result",
        proposalId,
        accountId: validatedAccountId,
        outcome,
        txHash: options.txHash,
        errorMessage: options.errorMessage,
      },
      trackingOptions,
    )
  }

  try {
    const body = await request.json()
    const parseResult = relayRequestSchema.safeParse(body)
    if (!parseResult.success) {
      return relayValidationError("invalid_request_body", "Invalid request body")
    }

    // Decode base64 → bytes → deserialize SignedDelegate
    const bytes = Buffer.from(parseResult.data.signedDelegate, "base64")
    if (bytes.length > MAX_SIGNED_DELEGATE_BYTES) {
      return relayValidationError("payload_too_large", "SignedDelegate payload too large", 413)
    }
    let deserialized: DeserializedSignedDelegate
    try {
      deserialized = deserialize(SCHEMA.SignedDelegate, new Uint8Array(bytes)) as DeserializedSignedDelegate
    } catch {
      return relayValidationError("invalid_signed_delegate_encoding", "Invalid SignedDelegate encoding")
    }

    const { delegateAction, signature } = deserialized

    // Validate senderId is a proper NEAR account
    const senderParsed = nearAccountIdSchema.safeParse(delegateAction.senderId)
    if (!senderParsed.success) {
      return relayValidationError("invalid_sender_account_id", "Invalid sender account ID")
    }
    validatedAccountId = senderParsed.data
    log.set("account_id", validatedAccountId)

    // --- Validation ---

    // 1. Contract whitelist
    const governanceContractId = NEAR_CONFIG.governanceContractId
    if (!governanceContractId) {
      return relayValidationError("relayer_not_configured", "Governance contract not configured", 503)
    }
    if (delegateAction.receiverId !== governanceContractId) {
      return relayValidationError("invalid_receiver_contract", "Relay only supports the governance contract")
    }

    // 2. Single action, must be FunctionCall
    if (delegateAction.actions.length !== 1) {
      return relayValidationError("invalid_action_count", "Relay only supports single-action delegates")
    }

    const innerAction = delegateAction.actions[0]
    const functionCallData = innerAction.functionCall as DeserializedFunctionCall | undefined

    if (!functionCallData) {
      return relayValidationError("invalid_action_type", "Relay only supports FunctionCall actions")
    }

    // 3. Method whitelist
    if (functionCallData.methodName !== "cast_vote") {
      return relayValidationError("invalid_method_name", "Relay only supports cast_vote")
    }

    // 4. Verify SignedDelegate signature + access key ownership/permissions
    const publicKeyData = parsePublicKey(delegateAction.publicKey)
    if (!publicKeyData) {
      return relayValidationError("invalid_delegate_public_key", "Invalid delegate public key")
    }

    const signatureData = parseSignature(signature)
    if (!signatureData) {
      return relayValidationError("invalid_delegate_signature", "Invalid SignedDelegate signature")
    }

    if (signatureData.keyType !== publicKeyData.keyType) {
      return relayValidationError("signature_key_type_mismatch", "SignedDelegate signature key type mismatch")
    }

    const publicKey = new PublicKey(publicKeyData)
    const message = encodeDelegateAction(delegateAction as unknown as DelegateAction)
    const messageHash = sha256(message)
    const signatureValid = publicKey.verify(messageHash, signatureData.data)
    if (!signatureValid) {
      return relayValidationError("signature_verification_failed", "Invalid SignedDelegate signature")
    }

    // 5. Deposit check — must be zero
    if (functionCallData.deposit !== BigInt(0)) {
      return relayValidationError("invalid_attached_deposit", "Relay does not support attached deposits")
    }

    // 5b. Gas check — require enough gas for governance cast_vote flow, but cap relayer exposure
    if (functionCallData.gas < MIN_CAST_VOTE_GAS) {
      return relayValidationError("insufficient_cast_vote_gas", "Insufficient gas for cast_vote")
    }
    if (functionCallData.gas > MAX_CAST_VOTE_GAS) {
      return relayValidationError("cast_vote_gas_exceeds_policy", "Gas exceeds relay policy")
    }

    // 6. Rate limit: 1 relay per voter per minute
    const redis = await Sentry.startSpan({ name: "governance.relay.getRedisClient", op: "db.redis" }, () =>
      getRedisClient(),
    )
    const rateLimitKey = `relay:vote:${validatedAccountId}`
    const acquiredRateLimit = await redis.set(rateLimitKey, "1", { EX: RATE_LIMIT_TTL, NX: true })
    if (acquiredRateLimit !== "OK") {
      return relayValidationError("relay_rate_limited", "Rate limited — please wait before voting again", 429)
    }

    // 7. Block height check
    const provider = createRpcProvider()
    const nodeStatus = await Sentry.startSpan({ name: "governance.relay.viewNodeStatus", op: "http.client" }, () =>
      provider.viewNodeStatus(),
    )
    const currentBlockHeight = BigInt(nodeStatus.sync_info.latest_block_height)
    if (delegateAction.maxBlockHeight < currentBlockHeight) {
      return relayValidationError("delegate_expired", "DelegateAction has expired (maxBlockHeight in the past)")
    }
    if (delegateAction.maxBlockHeight > currentBlockHeight + BigInt(MAX_BLOCK_HEIGHT_WINDOW)) {
      return relayValidationError(
        "delegate_block_height_window_exceeded",
        "DelegateAction maxBlockHeight is too far in the future",
      )
    }

    // 8. Access key check — public key must belong to sender and allow this call
    const accessKeyResult = await verifyAccessKeyPermission(
      provider,
      validatedAccountId,
      publicKey.toString(),
      governanceContractId,
      functionCallData.methodName,
    )
    if (!accessKeyResult.ok) {
      return relayValidationError("invalid_access_key", accessKeyResult.error ?? "Invalid access key")
    }

    // 9. Parse and validate cast_vote arguments
    const castVoteArgs = parseCastVoteArgs(functionCallData.args)
    if (!castVoteArgs) {
      return relayValidationError("invalid_cast_vote_args", "Invalid cast_vote arguments")
    }
    relayProposalId = castVoteArgs.proposalId
    log.set("proposal_id", castVoteArgs.proposalId)

    // 10. Eligibility preflight — only sponsor verified voters eligible for this proposal
    try {
      const [proposalResult, governanceConfigRaw] = await Sentry.startSpan(
        {
          name: "governance.relay.preflight.proposal_and_config",
          op: "http.client",
          attributes: {
            proposal_id: castVoteArgs.proposalId,
            governance_contract_id: governanceContractId,
          },
        },
        () =>
          Promise.all([
            provider.callFunction<JsonObject>(governanceContractId, "get_proposal", {
              proposal_id: castVoteArgs.proposalId,
            }),
            provider.callFunction<JsonObject>(governanceContractId, "get_config", {}),
          ]),
      )
      const proposalRaw = proposalResult as JsonObject | null

      if (!proposalRaw) {
        return relayValidationError("proposal_not_found", "Proposal not found", 404, undefined, {
          proposalId: castVoteArgs.proposalId,
        })
      }

      const parsedProposal = contractProposalViewSchema.safeParse(proposalRaw)
      if (!parsedProposal.success) {
        return relayValidationError("invalid_proposal_response", "Invalid proposal response from RPC", 502, undefined, {
          proposalId: castVoteArgs.proposalId,
        })
      }
      const now = Date.now()
      const proposalStatus = parsedProposal.data.status
      const proposalVotingClosed =
        now >= parsedProposal.data.endsAt ||
        proposalStatus === "failed" ||
        proposalStatus === "succeeded" ||
        proposalStatus === "cancelled"
      const proposalNotStarted = now < parsedProposal.data.startAt || proposalStatus === "pending"
      if (proposalStatus !== "active" || proposalNotStarted || proposalVotingClosed) {
        let voteRejectionReason: VoteRejectionReason | undefined
        if (proposalStatus === "cancelled") {
          voteRejectionReason = "proposal_cancelled"
        } else if (proposalVotingClosed) {
          voteRejectionReason = "proposal_expired"
        }

        return relayValidationError(
          "eligibility_preflight_failed",
          "Proposal is not open for voting",
          409,
          voteRejectionReason,
          {
            proposalId: castVoteArgs.proposalId,
          },
        )
      }

      const parsedConfig = contractConfigSchema.safeParse(governanceConfigRaw)
      if (!parsedConfig.success) {
        return relayValidationError(
          "invalid_governance_config_response",
          "Invalid governance config response from RPC",
          502,
          undefined,
          {
            proposalId: castVoteArgs.proposalId,
          },
        )
      }

      const verificationResult = await Sentry.startSpan(
        {
          name: "governance.relay.preflight.get_verification",
          op: "http.client",
          attributes: {
            account_id: validatedAccountId,
            verified_accounts_contract: parsedConfig.data.verifiedAccountsContract,
          },
        },
        () =>
          provider.callFunction<JsonObject>(parsedConfig.data.verifiedAccountsContract, "get_verification", {
            account_id: validatedAccountId,
          }),
      )
      const verificationRaw = verificationResult as JsonObject | null

      if (!verificationRaw) {
        return relayValidationError(
          "not_verified_for_relay",
          "Only verified accounts can use gasless voting",
          403,
          "not_verified",
          {
            proposalId: castVoteArgs.proposalId,
          },
        )
      }

      const parsedVerification = contractVerificationSummarySchema.safeParse(verificationRaw)
      if (!parsedVerification.success) {
        return relayValidationError(
          "invalid_verification_response",
          "Invalid verification response from RPC",
          502,
          undefined,
          {
            proposalId: castVoteArgs.proposalId,
          },
        )
      }

      if (parsedVerification.data.nearAccountId !== validatedAccountId) {
        return relayValidationError("verification_record_mismatch", "Verification record mismatch", 422, undefined, {
          proposalId: castVoteArgs.proposalId,
        })
      }

      if (parsedVerification.data.verifiedAt > parsedProposal.data.createdAt) {
        return relayValidationError(
          "verified_after_creation",
          "Account was verified after proposal creation",
          403,
          "verified_after_creation",
          {
            proposalId: castVoteArgs.proposalId,
          },
        )
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error"
      return relayValidationError(
        "eligibility_preflight_failed",
        `Eligibility preflight failed: ${message}`,
        503,
        undefined,
        {
          proposalId: castVoteArgs.proposalId,
        },
      )
    }

    // 11. isVoteFree check — relay only makes sense when voting is free
    const isVoteFree = await Sentry.startSpan({ name: "governance.relay.isVoteFree", op: "db.near-contract" }, () =>
      governanceReader.isVoteFree(),
    )
    if (!isVoteFree) {
      return relayValidationError(
        "vote_not_free",
        "Voting currently requires a storage deposit; relay unavailable",
        409,
      )
    }

    // --- Verify backend wallet is configured ---
    if (!NEAR_SERVER_CONFIG.backendAccountId || !NEAR_SERVER_CONFIG.backendPrivateKey) {
      return relayValidationError("relayer_not_configured", "Relayer not configured", 503)
    }

    // --- Build and send wrapping transaction ---
    await Sentry.startSpan({ name: "governance.relay.ensureRedisInitialized", op: "db.redis" }, () =>
      ensureRedisInitialized(),
    )
    const { account } = await Sentry.startSpan(
      {
        name: "governance.relay.createAccountWithNextKey",
        op: "wallet.key_pool",
        attributes: { account_id: validatedAccountId },
      },
      () => backendKeyPool.createAccountWithNextKey(),
    )

    // actionCreators.signedDelegate wraps the DelegateAction + signature into an Action.
    // Borsh v2 deserialization returns plain objects structurally matching the schema;
    // at runtime these are compatible with the class-based types.
    const action = actionCreators.signedDelegate({
      delegateAction: delegateAction as unknown as DelegateAction,
      signature: signature as unknown as Signature,
    })

    const result = await Sentry.startSpan(
      {
        name: "governance.relay.signAndSendTransaction",
        op: "http.client",
        attributes: { account_id: validatedAccountId, receiver_id: delegateAction.senderId },
      },
      () =>
        account.signAndSendTransaction({
          // NEP-366: wrapping tx is sent to the voter's account, not the contract
          receiverId: delegateAction.senderId,
          actions: [action],
        }),
    )

    const txHash = result.transaction_outcome.id
    log.set("tx_hash", txHash)

    const outcome = resolveGovernanceVoteOutcome(result)
    if (outcome.kind === "tx_failed") {
      log.setAll({
        relay_outcome: "tx_failed",
        error_message: outcome.error,
      })
      await trackRelaySubmissionResult("tx_failed", {
        proposalId: castVoteArgs.proposalId,
        txHash,
        errorMessage: outcome.error,
      })
      Sentry.logger.error("governance_relay_tx_failed", {
        account_id: validatedAccountId ?? "unknown",
        proposal_id: castVoteArgs.proposalId,
        tx_hash: txHash,
        error_message: outcome.error,
      })
      return relayError(outcome.error, 422)
    }
    if (outcome.kind === "vote_rejected") {
      const rejectionMessage = getVoteRejectionReasonMessage(outcome.reason)
      log.setAll({
        relay_outcome: "vote_rejected",
        vote_rejection_reason: outcome.reason,
        error_message: rejectionMessage,
      })
      await trackRelaySubmissionResult("tx_failed", {
        proposalId: castVoteArgs.proposalId,
        txHash,
        errorMessage: rejectionMessage,
      })
      Sentry.logger.warn("governance_relay_vote_rejected", {
        account_id: validatedAccountId ?? "unknown",
        proposal_id: castVoteArgs.proposalId,
        tx_hash: txHash,
        vote_rejection_reason: outcome.reason,
      })
      return relayError(rejectionMessage, 422, outcome.reason)
    }

    await trackRelaySubmissionResult("success", {
      proposalId: castVoteArgs.proposalId,
      txHash,
    })

    const tags = getGovernanceInvalidationTags({
      op: "vote_cast",
      proposalId: castVoteArgs.proposalId,
      accountId: validatedAccountId,
    })
    for (const tag of tags) {
      revalidateTag(tag, { expire: 0 })
    }

    log.set("relay_outcome", "success")
    return NextResponse.json({ success: true, txHash, outcome }, { status: 200 })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Internal server error"
    log.setAll({
      relay_outcome: "error",
      error_message: errorMessage,
    })
    Sentry.captureException(error, {
      tags: { route: "api/governance/relay" },
      extra: { account_id: validatedAccountId ?? "unknown" },
    })
    Sentry.logger.error("governance_relay_error", {
      account_id: validatedAccountId ?? "unknown",
      error_message: errorMessage,
    })

    await trackServerEvent(
      validatedAccountId ?? "anonymous",
      {
        domain: "governance",
        action: "relay_error",
        accountId: validatedAccountId,
        proposalId: relayProposalId,
        errorMessage,
      },
      trackingOptions,
    )

    return relayError(errorMessage, 500)
  }
})
