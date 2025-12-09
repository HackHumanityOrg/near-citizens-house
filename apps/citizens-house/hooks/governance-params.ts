"use client"

import useSWRImmutable from "swr/immutable"
import { getTotalCitizens, getGovernanceParameters } from "@/lib/actions/governance"

export interface GovernanceParams {
  quorumPercentageMin: number
  quorumPercentageMax: number
  quorumPercentageDefault: number
}

export interface UseGovernanceParamsResult {
  /** Total number of verified citizens */
  totalCitizens: number
  /** Governance parameters from contract */
  governanceParams: GovernanceParams | null
  /** Loading state */
  loading: boolean
}

/**
 * Hook to fetch governance parameters and total citizens count
 *
 * Uses SWR with immutable caching since these values rarely change.
 */
export function useGovernanceParams(): UseGovernanceParamsResult {
  const { data, isLoading } = useSWRImmutable("governance-params", async () => {
    const [total, params] = await Promise.all([getTotalCitizens(), getGovernanceParameters()])
    return { totalCitizens: total, governanceParams: params }
  })

  return {
    totalCitizens: data?.totalCitizens ?? 0,
    governanceParams: data?.governanceParams ?? null,
    loading: isLoading,
  }
}
