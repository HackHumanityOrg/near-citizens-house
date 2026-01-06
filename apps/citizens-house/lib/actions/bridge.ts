"use server"

import { bridgeContract, verificationDb, nearAccountIdSchema, type BridgeInfo } from "@near-citizens/shared"
import { createServerActionEvent } from "@/lib/logger"

/**
 * Get bridge contract configuration
 */
export async function getBridgeInfo(): Promise<BridgeInfo | null> {
  const event = createServerActionEvent("bridge.getInfo")
  try {
    const info = await bridgeContract.getInfo()
    event.info("Bridge info fetched")
    return info
  } catch (error) {
    event.setError(error instanceof Error ? error : { message: "Unknown error" })
    event.error("Error fetching bridge info")
    return null
  }
}

/**
 * Get the backend wallet address
 */
export async function getBackendWallet(): Promise<string | null> {
  const event = createServerActionEvent("bridge.getBackendWallet")
  try {
    const wallet = await bridgeContract.getBackendWallet()
    event.info("Backend wallet fetched")
    return wallet
  } catch (error) {
    event.setError(error instanceof Error ? error : { message: "Unknown error" })
    event.error("Error fetching backend wallet")
    return null
  }
}

/**
 * Get the SputnikDAO contract address
 */
export async function getSputnikDaoAddress(): Promise<string | null> {
  const event = createServerActionEvent("bridge.getSputnikDao")
  try {
    const address = await bridgeContract.getSputnikDao()
    event.info("SputnikDAO address fetched")
    return address
  } catch (error) {
    event.setError(error instanceof Error ? error : { message: "Unknown error" })
    event.error("Error fetching SputnikDAO address")
    return null
  }
}

/**
 * Get the verified accounts contract address
 */
export async function getVerifiedAccountsContract(): Promise<string | null> {
  const event = createServerActionEvent("bridge.getVerifiedAccountsContract")
  try {
    const contract = await bridgeContract.getVerifiedAccountsContract()
    event.info("Verified accounts contract fetched")
    return contract
  } catch (error) {
    event.setError(error instanceof Error ? error : { message: "Unknown error" })
    event.error("Error fetching verified accounts contract")
    return null
  }
}

/**
 * Get the citizen role name
 */
export async function getCitizenRole(): Promise<string | null> {
  const event = createServerActionEvent("bridge.getCitizenRole")
  try {
    const role = await bridgeContract.getCitizenRole()
    event.info("Citizen role fetched")
    return role
  } catch (error) {
    event.setError(error instanceof Error ? error : { message: "Unknown error" })
    event.error("Error fetching citizen role")
    return null
  }
}

/**
 * Check if an account is verified
 */
export async function checkVerificationStatus(accountId: string): Promise<boolean> {
  const event = createServerActionEvent("bridge.checkVerificationStatus")
  event.setUser({ account_id: accountId })

  const parsed = nearAccountIdSchema.safeParse(accountId)
  if (!parsed.success) {
    event.setError({ code: "INVALID_ACCOUNT_ID", message: "Invalid account ID format" })
    event.error("Invalid account ID")
    return false
  }

  try {
    const isVerified = await verificationDb.isVerified(parsed.data)
    event.set("is_verified", isVerified)
    event.info("Verification status checked")
    return isVerified
  } catch (error) {
    event.setError(error instanceof Error ? error : { message: "Unknown error" })
    event.error("Error checking verification")
    return false
  }
}
