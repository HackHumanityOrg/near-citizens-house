export type NearNetwork = "mainnet" | "testnet"

export const FASTNEAR_BIG_MAINNET_RPC_URL = "https://rpc.mainnet.fastnear.com"
export const FASTNEAR_TESTNET_RPC_URL = "https://rpc.testnet.fastnear.com"

/**
 * Resolve the FastNEAR RPC URL for a given NEAR network.
 * Big Powerful RPC is currently used for mainnet traffic.
 */
export function getFastNearRpcUrl(network: NearNetwork): string {
  return network === "mainnet" ? FASTNEAR_BIG_MAINNET_RPC_URL : FASTNEAR_TESTNET_RPC_URL
}
