"use client"

import useSWRImmutable from "swr/immutable"
import { useNearWallet } from "@/lib"
import { checkIsVerified } from "@/app/citizens/actions"

export interface UseVerificationResult {
  /** Whether the connected wallet is verified */
  isVerified: boolean
  /** Loading state while checking verification status */
  loading: boolean
}

/**
 * Hook to check if the current wallet is verified
 *
 * Uses SWR with immutable caching to prevent refetching on navigation.
 * Data is cached per account and only fetched once per session.
 */
export function useVerification(): UseVerificationResult {
  const { accountId } = useNearWallet()

  const { data: isVerified, isLoading } = useSWRImmutable(accountId ? ["verification", accountId] : null, () =>
    checkIsVerified(accountId!),
  )

  return {
    isVerified: isVerified === true,
    loading: isLoading,
  }
}
