/**
 * BigQuery client for querying NEAR Protocol public dataset
 *
 * Uses Google Cloud BigQuery to query the NEAR public dataset for
 * account information like creation dates.
 *
 * Dataset: bigquery-public-data.crypto_near_mainnet_us
 * Tables used:
 * - receipt_actions: Contains CREATE_ACCOUNT/TRANSFER/DETERMINISTIC_STATE_INIT actions with timestamps
 *
 * Authentication options:
 * 1. GOOGLE_APPLICATION_CREDENTIALS env var pointing to service account JSON
 * 2. GCP_BIGQUERY_CREDENTIALS env var with JSON string of credentials
 * 3. Application Default Credentials (in GCP environment)
 */

import { BigQuery } from "@google-cloud/bigquery"
import { logger, Op } from "./logger"

// NEAR BigQuery public dataset - only mainnet data is available
// Note: There is no public testnet dataset in BigQuery
const NEAR_DATASET = "bigquery-public-data.crypto_near_mainnet_us"

const NEAR_IMPLICIT_ACCOUNT_ID = /^[0-9a-f]{64}$/
const ETH_IMPLICIT_ACCOUNT_ID = /^0x[0-9a-f]{40}$/
const DETERMINISTIC_ACCOUNT_ID = /^0s[0-9a-f]{40}$/

type AccountKind = "named" | "near-implicit" | "eth-implicit" | "deterministic"

function getAccountKind(accountId: string): AccountKind {
  if (NEAR_IMPLICIT_ACCOUNT_ID.test(accountId)) {
    return "near-implicit"
  }

  if (ETH_IMPLICIT_ACCOUNT_ID.test(accountId)) {
    return "eth-implicit"
  }

  if (DETERMINISTIC_ACCOUNT_ID.test(accountId)) {
    return "deterministic"
  }

  return "named"
}

// Singleton BigQuery client
let bigqueryClient: BigQuery | null = null

/**
 * Create a new BigQuery client with appropriate credentials
 */
function createBigQueryClient(): BigQuery {
  const credentialsJson = process.env.GCP_BIGQUERY_CREDENTIALS

  if (credentialsJson) {
    // Parse credentials from environment variable
    try {
      const credentials = JSON.parse(credentialsJson)
      return new BigQuery({
        projectId: credentials.project_id,
        credentials: {
          client_email: credentials.client_email,
          private_key: credentials.private_key,
        },
      })
    } catch (error) {
      logger.error("Failed to parse GCP_BIGQUERY_CREDENTIALS", {
        operation: Op.BIGQUERY.INIT,
        error_message: error instanceof Error ? error.message : String(error),
      })
      throw new Error("Invalid GCP_BIGQUERY_CREDENTIALS format")
    }
  }

  // Use Application Default Credentials or GOOGLE_APPLICATION_CREDENTIALS
  return new BigQuery()
}

/**
 * Get or create the BigQuery client singleton
 * Uses nullish coalescing assignment for atomic initialization
 */
function getBigQueryClient(): BigQuery {
  return (bigqueryClient ??= createBigQueryClient())
}

interface BigQueryRow {
  block_date?: { value?: string } | string
  block_height?: number | string
  block_timestamp_utc?: { value?: string } | string | number
}

function unwrapBigQueryValue(value: { value?: string } | string | number | undefined): string | number | undefined {
  if (typeof value === "object" && value && "value" in value) {
    return value.value
  }

  if (typeof value === "object") {
    return undefined
  }

  return value
}

function parseCreationRow(accountId: string, row: BigQueryRow): AccountCreationResult {
  const blockDateValue = unwrapBigQueryValue(row.block_date)
  const timestampValue = unwrapBigQueryValue(row.block_timestamp_utc)

  const createdAt = timestampValue !== undefined ? new Date(timestampValue) : new Date(blockDateValue ?? "")
  const blockDate = blockDateValue ?? ""

  return {
    success: true,
    accountId,
    createdAt,
    blockDate: String(blockDate),
    blockHeight: Number(row.block_height),
  }
}

async function queryFirstActionRow(
  client: BigQuery,
  dataset: string,
  accountId: string,
  actionKinds: string[],
): Promise<BigQueryRow | null> {
  const query = `
    SELECT 
      block_date,
      block_height,
      block_timestamp_utc
    FROM \`${dataset}.receipt_actions\`
    WHERE action_kind IN UNNEST(@actionKinds)
      AND receipt_receiver_account_id = @accountId
    ORDER BY block_height ASC
    LIMIT 1
  `

  const [rows] = await client.query({
    query,
    params: { accountId, actionKinds },
  })

  return rows && rows.length > 0 ? (rows[0] as BigQueryRow) : null
}

/**
 * Result of account creation query
 */
export interface AccountCreationResult {
  success: true
  accountId: string
  createdAt: Date
  blockDate: string
  blockHeight: number
}

export interface AccountCreationError {
  success: false
  accountId: string
  error: "not_found" | "query_error" | "genesis_account"
  message: string
}

export type AccountCreationQueryResult = AccountCreationResult | AccountCreationError

/**
 * Query the account creation date from NEAR BigQuery public dataset.
 *
 * Always queries the mainnet dataset (testnet data is not available in BigQuery).
 * For testnet deployments, account age verification should be skipped at a higher level.
 *
 * Looks for the first CREATE_ACCOUNT action for named accounts, TRANSFER for implicit
 * accounts, and DETERMINISTIC_STATE_INIT for deterministic accounts.
 * Genesis accounts (created at network launch) may not have CREATE_ACCOUNT actions.
 *
 * @param accountId - The NEAR account ID to look up
 */
export async function getAccountCreationDate(accountId: string): Promise<AccountCreationQueryResult> {
  const client = getBigQueryClient()
  const accountKind = getAccountKind(accountId)
  const dataset = NEAR_DATASET

  try {
    const createAccountRow = await queryFirstActionRow(client, dataset, accountId, ["CREATE_ACCOUNT"])
    if (createAccountRow) {
      return parseCreationRow(accountId, createAccountRow)
    }

    if (accountKind === "near-implicit" || accountKind === "eth-implicit") {
      const implicitRow = await queryFirstActionRow(client, dataset, accountId, ["TRANSFER"])
      if (implicitRow) {
        return parseCreationRow(accountId, implicitRow)
      }

      return {
        success: false,
        accountId,
        error: "not_found",
        message: "Implicit account not found in NEAR blockchain data",
      }
    }

    if (accountKind === "deterministic") {
      const deterministicRow = await queryFirstActionRow(client, dataset, accountId, [
        "DETERMINISTIC_STATE_INIT",
        "DETERMINISTIC_STATE_INIT_ACTION",
      ])
      if (deterministicRow) {
        return parseCreationRow(accountId, deterministicRow)
      }

      return {
        success: false,
        accountId,
        error: "not_found",
        message: "Deterministic account not found in NEAR blockchain data",
      }
    }

    // Account might be a genesis account or doesn't exist
    // Check if account exists by looking for any transaction
    const existsQuery = `
      SELECT 1
      FROM \`${dataset}.transactions\`
      WHERE signer_account_id = @accountId
         OR receiver_account_id = @accountId
      LIMIT 1
    `

    const [existsRows] = await client.query({
      query: existsQuery,
      params: { accountId },
    })

    if (existsRows && existsRows.length > 0) {
      // Account exists but no CREATE_ACCOUNT action found - likely genesis account
      return {
        success: false,
        accountId,
        error: "genesis_account",
        message: "Account is a genesis account (created at network launch)",
      }
    }

    return {
      success: false,
      accountId,
      error: "not_found",
      message: "Account not found in NEAR blockchain data",
    }
  } catch (error) {
    logger.error("Error querying account creation", {
      operation: Op.BIGQUERY.QUERY,
      account_id: accountId,
      error_message: error instanceof Error ? error.message : "Unknown query error",
    })
    return {
      success: false,
      accountId,
      error: "query_error",
      message: error instanceof Error ? error.message : "Unknown query error",
    }
  }
}
