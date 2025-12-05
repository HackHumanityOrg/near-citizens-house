"use server"

import { bridgeContract, type BridgeInfo } from "@near-citizens/shared"

/**
 * Get bridge contract configuration
 */
export async function getBridgeInfo(): Promise<BridgeInfo> {
  return bridgeContract.getInfo()
}

/**
 * Get the backend wallet address
 */
export async function getBackendWallet(): Promise<string> {
  return bridgeContract.getBackendWallet()
}

/**
 * Get the SputnikDAO contract address
 */
export async function getSputnikDaoAddress(): Promise<string> {
  return bridgeContract.getSputnikDao()
}

/**
 * Get the verified accounts contract address
 */
export async function getVerifiedAccountsContract(): Promise<string> {
  return bridgeContract.getVerifiedAccountsContract()
}

/**
 * Get the citizen role name
 */
export async function getCitizenRole(): Promise<string> {
  return bridgeContract.getCitizenRole()
}
