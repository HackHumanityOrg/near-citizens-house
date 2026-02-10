/**
 * NEP-366 Meta-Transaction Relayer for Gasless Governance Voting
 *
 * Accepts a base64-encoded SignedDelegate from zero-balance voters,
 * validates it, and submits a wrapping transaction using the backend key pool.
 * The NEAR runtime unwraps the DelegateAction so predecessor_account_id = voter.
 */
import { type NextRequest, NextResponse } from "next/server"
import { deserialize } from "borsh"
import { SCHEMA, actionCreators, type DelegateAction, type Signature } from "@near-js/transactions"
import { NEAR_CONFIG } from "@/lib/config"
import { NEAR_SERVER_CONFIG } from "@/lib/config.server"
import { backendKeyPool, setBackendKeyPoolRedis } from "@/lib/backend-key-pool"
import { getRedisClient } from "@/lib/redis"
import { createRpcProvider } from "@/lib/providers/rpc-provider"
import { governanceReader } from "@/lib/contracts/governance/client"
import { relayRequestSchema, voteChoiceSchema } from "@/lib/schemas/governance-contract"
import { trackServerEvent } from "@/lib/analytics-server"
import { nearAccountIdSchema, type NearAccountId } from "@/lib/schemas/near"
import type { FinalExecutionOutcome } from "@near-js/types"

const RATE_LIMIT_TTL = 60 // 1 relay per voter per minute
const MAX_BLOCK_HEIGHT_WINDOW = 500

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

function relayError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status })
}

/**
 * Recursively search a nested object for a string value.
 * NEAR RPC failure objects are deeply nested — e.g.:
 *   { ActionError: { kind: { FunctionCallError: { ExecutionError: "Smart contract panicked: ERR_..." } } } }
 * This walks the tree and returns the deepest string found.
 */
function deepExtractErrorMessage(obj: unknown): string | null {
  if (typeof obj === "string") return obj
  if (typeof obj !== "object" || obj === null) return null

  for (const value of Object.values(obj)) {
    const found = deepExtractErrorMessage(value)
    if (found) return found
  }

  return null
}

/**
 * Extract the first execution failure from a FinalExecutionOutcome.
 * Returns the error message string, or null if execution succeeded.
 *
 * A transaction can be included in a block (HTTP 200 from RPC) but the inner
 * function call may still fail (e.g. contract panic, ERR_PROPOSAL_ENDED).
 * We check both the top-level status and all receipt outcomes.
 */
function extractExecutionFailure(result: FinalExecutionOutcome): string | null {
  // Check top-level status
  if (typeof result.status === "object" && "Failure" in result.status && result.status.Failure) {
    return deepExtractErrorMessage(result.status.Failure) ?? "Transaction execution failed"
  }

  // Check receipt outcomes — the inner function call failure shows up here
  for (const receipt of result.receipts_outcome) {
    const receiptStatus = receipt.outcome.status
    if (typeof receiptStatus === "object" && "Failure" in receiptStatus && receiptStatus.Failure) {
      return deepExtractErrorMessage(receiptStatus.Failure) ?? "Receipt execution failed"
    }
  }

  return null
}

/**
 * Try to parse cast_vote args from the FunctionCall bytes.
 * Returns { proposal_id, choice } or null if parsing fails.
 */
function parseCastVoteArgs(args: Uint8Array): { proposal_id: number; choice: string } | null {
  try {
    const json = JSON.parse(Buffer.from(args).toString("utf-8"))
    if (typeof json.proposal_id === "number" && typeof json.choice === "string") {
      return json
    }
  } catch {
    // Invalid args
  }
  return null
}

export async function POST(request: NextRequest) {
  let validatedAccountId: NearAccountId | undefined

  try {
    const body = await request.json()
    const parseResult = relayRequestSchema.safeParse(body)
    if (!parseResult.success) {
      return relayError("Invalid request body")
    }

    // Decode base64 → bytes → deserialize SignedDelegate
    const bytes = Buffer.from(parseResult.data.signedDelegate, "base64")
    let deserialized: DeserializedSignedDelegate
    try {
      deserialized = deserialize(SCHEMA.SignedDelegate, new Uint8Array(bytes)) as DeserializedSignedDelegate
    } catch {
      return relayError("Invalid SignedDelegate encoding")
    }

    const { delegateAction, signature } = deserialized

    // Validate senderId is a proper NEAR account
    const senderParsed = nearAccountIdSchema.safeParse(delegateAction.senderId)
    if (!senderParsed.success) {
      return relayError("Invalid sender account ID")
    }
    validatedAccountId = senderParsed.data

    // --- Validation ---

    // 1. Contract whitelist
    const governanceContractId = NEAR_CONFIG.governanceContractId
    if (delegateAction.receiverId !== governanceContractId) {
      return relayError("Relay only supports the governance contract")
    }

    // 2. Single action, must be FunctionCall
    if (delegateAction.actions.length !== 1) {
      return relayError("Relay only supports single-action delegates")
    }

    const innerAction = delegateAction.actions[0]
    const functionCallData = innerAction.functionCall as DeserializedFunctionCall | undefined

    if (!functionCallData) {
      return relayError("Relay only supports FunctionCall actions")
    }

    // 3. Method whitelist
    if (functionCallData.methodName !== "cast_vote") {
      return relayError("Relay only supports cast_vote")
    }

    // 4. Deposit check — must be zero
    if (functionCallData.deposit !== BigInt(0)) {
      return relayError("Relay does not support attached deposits")
    }

    // 5. Block height check
    const provider = createRpcProvider()
    const nodeStatus = await provider.viewNodeStatus()
    const currentBlockHeight = BigInt(nodeStatus.sync_info.latest_block_height)
    if (delegateAction.maxBlockHeight < currentBlockHeight) {
      return relayError("DelegateAction has expired (maxBlockHeight in the past)")
    }
    if (delegateAction.maxBlockHeight > currentBlockHeight + BigInt(MAX_BLOCK_HEIGHT_WINDOW)) {
      return relayError("DelegateAction maxBlockHeight is too far in the future")
    }

    // 6. isVoteFree check — relay only makes sense when voting is free
    const isVoteFree = await governanceReader.isVoteFree()
    if (!isVoteFree) {
      return relayError("Voting currently requires a storage deposit; relay unavailable", 409)
    }

    // 7. Rate limit: 1 relay per voter per minute
    const redis = await getRedisClient()
    const rateLimitKey = `relay:vote:${validatedAccountId}`
    const existing = await redis.get(rateLimitKey)
    if (existing) {
      return relayError("Rate limited — please wait before voting again", 429)
    }
    await redis.set(rateLimitKey, "1", { EX: RATE_LIMIT_TTL })

    // --- Verify backend wallet is configured ---
    if (!NEAR_SERVER_CONFIG.backendAccountId || !NEAR_SERVER_CONFIG.backendPrivateKey) {
      return relayError("Relayer not configured", 503)
    }

    // --- Build and send wrapping transaction ---
    await ensureRedisInitialized()
    const { account } = await backendKeyPool.createAccountWithNextKey()

    // actionCreators.signedDelegate wraps the DelegateAction + signature into an Action.
    // Borsh v2 deserialization returns plain objects structurally matching the schema;
    // at runtime these are compatible with the class-based types.
    const action = actionCreators.signedDelegate({
      delegateAction: delegateAction as unknown as DelegateAction,
      signature: signature as unknown as Signature,
    })

    const result = await account.signAndSendTransaction({
      // NEP-366: wrapping tx is sent to the voter's account, not the contract
      receiverId: delegateAction.senderId,
      actions: [action],
    })

    const txHash = result.transaction_outcome.id

    // Parse vote args for analytics (best-effort)
    const voteArgs = parseCastVoteArgs(functionCallData.args)
    const choiceParsed = voteChoiceSchema.safeParse(voteArgs?.choice)

    // Check if the on-chain execution actually succeeded.
    // The transaction can be included in a block but the inner function call may still fail
    // (e.g. ERR_PROPOSAL_ENDED, ERR_ALREADY_VOTED, contract panic).
    const executionFailed = extractExecutionFailure(result)
    if (executionFailed) {
      console.error(`[relay] On-chain execution failed for ${validatedAccountId}: ${executionFailed}`, { txHash })

      if (voteArgs) {
        await trackServerEvent(validatedAccountId, {
          domain: "governance",
          action: "vote_cast_fail",
          proposalId: voteArgs.proposal_id,
          errorMessage: `On-chain: ${executionFailed}`,
          accountId: validatedAccountId,
        }).catch(() => {})
      }

      return relayError(executionFailed, 422)
    }

    if (voteArgs && choiceParsed.success) {
      await trackServerEvent(validatedAccountId, {
        domain: "governance",
        action: "vote_cast",
        proposalId: voteArgs.proposal_id,
        choice: choiceParsed.data,
        accountId: validatedAccountId,
      })
    }

    return NextResponse.json({ success: true, txHash }, { status: 200 })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Internal server error"
    console.error(`[relay] Error for ${validatedAccountId ?? "unknown"}:`, errorMessage)

    if (validatedAccountId) {
      await trackServerEvent(validatedAccountId, {
        domain: "governance",
        action: "vote_cast_fail",
        proposalId: 0,
        errorMessage: `Relay error: ${errorMessage}`,
        accountId: validatedAccountId,
      }).catch(() => {})
    }

    return relayError(errorMessage, 500)
  }
}
