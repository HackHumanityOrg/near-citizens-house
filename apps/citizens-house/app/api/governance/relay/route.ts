/**
 * NEP-366 Meta-Transaction Relayer for Gasless Governance Voting
 *
 * Accepts a base64-encoded SignedDelegate from zero-balance voters,
 * validates it, and submits a wrapping transaction using the backend key pool.
 * The NEAR runtime unwraps the DelegateAction so predecessor_account_id = voter.
 */
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
import {
  castVoteArgsSchema,
  contractConfigSchema,
  contractProposalViewSchema,
  MAX_SIGNED_DELEGATE_BYTES,
  relayRequestSchema,
} from "@/lib/schemas/governance-contract"
import {
  nearAccessKeyResponseSchema,
  nearAccountIdSchema,
  type NearAccessKeyPermission,
  type NearAccountId,
} from "@/lib/schemas/near"
import { contractVerificationSummarySchema } from "@/lib/schemas/verification-contract"
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

interface ParsedKeyData {
  keyType: KeyType
  data: Uint8Array
}

type JsonObject = Record<string, unknown>

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
    if (bytes.length > MAX_SIGNED_DELEGATE_BYTES) {
      return relayError("SignedDelegate payload too large", 413)
    }
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

    // 4. Verify SignedDelegate signature + access key ownership/permissions
    const publicKeyData = parsePublicKey(delegateAction.publicKey)
    if (!publicKeyData) {
      return relayError("Invalid delegate public key")
    }

    const signatureData = parseSignature(signature)
    if (!signatureData) {
      return relayError("Invalid SignedDelegate signature")
    }

    if (signatureData.keyType !== publicKeyData.keyType) {
      return relayError("SignedDelegate signature key type mismatch")
    }

    const publicKey = new PublicKey(publicKeyData)
    const message = encodeDelegateAction(delegateAction as unknown as DelegateAction)
    const messageHash = sha256(message)
    const signatureValid = publicKey.verify(messageHash, signatureData.data)
    if (!signatureValid) {
      return relayError("Invalid SignedDelegate signature")
    }

    // 5. Deposit check — must be zero
    if (functionCallData.deposit !== BigInt(0)) {
      return relayError("Relay does not support attached deposits")
    }

    // 6. Block height check
    const provider = createRpcProvider()
    const nodeStatus = await provider.viewNodeStatus()
    const currentBlockHeight = BigInt(nodeStatus.sync_info.latest_block_height)
    if (delegateAction.maxBlockHeight < currentBlockHeight) {
      return relayError("DelegateAction has expired (maxBlockHeight in the past)")
    }
    if (delegateAction.maxBlockHeight > currentBlockHeight + BigInt(MAX_BLOCK_HEIGHT_WINDOW)) {
      return relayError("DelegateAction maxBlockHeight is too far in the future")
    }

    // 7. Access key check — public key must belong to sender and allow this call
    const accessKeyResult = await verifyAccessKeyPermission(
      provider,
      validatedAccountId,
      publicKey.toString(),
      governanceContractId,
      functionCallData.methodName,
    )
    if (!accessKeyResult.ok) {
      return relayError(accessKeyResult.error ?? "Invalid access key")
    }

    // 8. Parse and validate cast_vote arguments
    const castVoteArgs = parseCastVoteArgs(functionCallData.args)
    if (!castVoteArgs) {
      return relayError("Invalid cast_vote arguments")
    }

    // 9. Eligibility preflight — only sponsor verified voters eligible for this proposal
    try {
      const [proposalResult, governanceConfigRaw] = await Promise.all([
        provider.callFunction<JsonObject>(governanceContractId, "get_proposal", {
          proposal_id: castVoteArgs.proposalId,
        }),
        provider.callFunction<JsonObject>(governanceContractId, "get_config", {}),
      ])
      const proposalRaw = proposalResult as JsonObject | null

      if (!proposalRaw) {
        return relayError("Proposal not found", 404)
      }

      const parsedProposal = contractProposalViewSchema.safeParse(proposalRaw)
      if (!parsedProposal.success) {
        return relayError("Invalid proposal response from RPC", 502)
      }

      const parsedConfig = contractConfigSchema.safeParse(governanceConfigRaw)
      if (!parsedConfig.success) {
        return relayError("Invalid governance config response from RPC", 502)
      }

      const verificationResult = await provider.callFunction<JsonObject>(
        parsedConfig.data.verifiedAccountsContract,
        "get_verification",
        { account_id: validatedAccountId },
      )
      const verificationRaw = verificationResult as JsonObject | null

      if (!verificationRaw) {
        return relayError("Only verified accounts can use gasless voting", 403)
      }

      const parsedVerification = contractVerificationSummarySchema.safeParse(verificationRaw)
      if (!parsedVerification.success) {
        return relayError("Invalid verification response from RPC", 502)
      }

      if (parsedVerification.data.nearAccountId !== validatedAccountId) {
        return relayError("Verification record mismatch", 422)
      }

      if (parsedVerification.data.verifiedAt > parsedProposal.data.createdAt) {
        return relayError("Account was verified after proposal creation", 403)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error"
      return relayError(`Eligibility preflight failed: ${message}`, 503)
    }

    // 10. isVoteFree check — relay only makes sense when voting is free
    const isVoteFree = await governanceReader.isVoteFree()
    if (!isVoteFree) {
      return relayError("Voting currently requires a storage deposit; relay unavailable", 409)
    }

    // 11. Rate limit: 1 relay per voter per minute
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

    // Check if the on-chain execution actually succeeded.
    // The transaction can be included in a block but the inner function call may still fail
    // (e.g. ERR_PROPOSAL_ENDED, ERR_ALREADY_VOTED, contract panic).
    const executionFailed = extractExecutionFailure(result)
    if (executionFailed) {
      console.error(`[relay] On-chain execution failed for ${validatedAccountId}: ${executionFailed}`, { txHash })
      return relayError(executionFailed, 422)
    }

    return NextResponse.json({ success: true, txHash }, { status: 200 })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Internal server error"
    console.error(`[relay] Error for ${validatedAccountId ?? "unknown"}:`, errorMessage)

    return relayError(errorMessage, 500)
  }
}
