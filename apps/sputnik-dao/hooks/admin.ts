"use client"

import { useEffect, useState, useRef } from "react"
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

// Module-level cache for backend wallet (static config, doesn't change)
let cachedBackendWallet: string | null = null
let cachePromise: Promise<string> | null = null

/**
 * Hook to check if the current wallet is the admin (backend wallet)
 *
 * Caches the backend wallet address at module level to prevent
 * re-fetching on every navigation (which causes Admin tab flash).
 *
 * Usage:
 * ```tsx
 * const { isAdmin, backendWallet, loading } = useIsAdmin()
 *
 * if (loading) return <Loading />
 * if (!isAdmin) return <AccessDenied />
 * return <AdminPanel />
 * ```
 */
export function useIsAdmin(): UseIsAdminResult {
  const { accountId } = useNearWallet()
  const [backendWallet, setBackendWallet] = useState<string | null>(cachedBackendWallet)
  const [loading, setLoading] = useState(cachedBackendWallet === null)
  const [error, setError] = useState<string | null>(null)
  const fetchedRef = useRef(false)

  useEffect(() => {
    // If we already have cached data, no need to fetch
    if (cachedBackendWallet !== null) {
      setBackendWallet(cachedBackendWallet)
      setLoading(false)
      return
    }

    // Prevent duplicate fetches in strict mode
    if (fetchedRef.current) return
    fetchedRef.current = true

    async function fetchBackendWallet() {
      try {
        // Reuse existing promise if one is in flight
        if (!cachePromise) {
          cachePromise = getBridgeInfo().then((info) => info.backendWallet)
        }
        const wallet = await cachePromise
        cachedBackendWallet = wallet
        setBackendWallet(wallet)
      } catch (err) {
        console.error("Error fetching backend wallet:", err)
        setError(err instanceof Error ? err.message : "Failed to check admin status")
      } finally {
        setLoading(false)
      }
    }

    fetchBackendWallet()
  }, [])

  // Compute isAdmin from cached backendWallet and current accountId
  const isAdmin = backendWallet !== null && accountId === backendWallet

  return { isAdmin, backendWallet, loading, error }
}
