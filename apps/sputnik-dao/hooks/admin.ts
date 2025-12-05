"use client"

import { useEffect, useState } from "react"
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
  const [isAdmin, setIsAdmin] = useState(false)
  const [backendWallet, setBackendWallet] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function checkAdmin() {
      setLoading(true)
      setError(null)

      try {
        const info = await getBridgeInfo()
        setBackendWallet(info.backendWallet)
        setIsAdmin(accountId === info.backendWallet)
      } catch (err) {
        console.error("Error checking admin status:", err)
        setError(err instanceof Error ? err.message : "Failed to check admin status")
        setIsAdmin(false)
      } finally {
        setLoading(false)
      }
    }

    if (accountId) {
      checkAdmin()
    } else {
      setIsAdmin(false)
      setBackendWallet(null)
      setLoading(false)
    }
  }, [accountId])

  return { isAdmin, backendWallet, loading, error }
}
