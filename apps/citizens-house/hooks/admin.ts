"use client"

import useSWRImmutable from "swr/immutable"
import { useNearWallet } from "@near-citizens/shared"
import { getBridgeInfo } from "@/lib/actions/bridge"

export interface UseIsAdminResult {
  /** Whether the connected wallet is the backend wallet */
  isAdmin: boolean
  /** The backend wallet address */
  backendWallet: string | null
  /** Loading state while checking admin status */
  loading: boolean
  /** Error if admin check failed */
  error: string | null
}

/**
 * Hook to check if the current wallet is the admin (backend wallet)
 *
 * Uses SWR with immutable caching to prevent refetching on navigation.
 * Backend wallet is static config that doesn't change during a session.
 */
export function useIsAdmin(): UseIsAdminResult {
  const { accountId } = useNearWallet()

  const { data: bridgeInfo, isLoading, error } = useSWRImmutable("bridge-info", () => getBridgeInfo())

  const backendWallet = bridgeInfo?.backendWallet ?? null
  const isAdmin = backendWallet !== null && accountId === backendWallet

  return {
    isAdmin,
    backendWallet,
    loading: isLoading,
    error: error ? (error instanceof Error ? error.message : "Failed to check admin status") : null,
  }
}
