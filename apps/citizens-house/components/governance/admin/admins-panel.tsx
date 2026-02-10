"use client"

import { useState, useEffect, useTransition } from "react"
import { Button, Input } from "@near-citizens/ui"
import { NEAR_CONFIG, useNearWallet } from "@/lib"
import { MiddleTruncate } from "@/components/ui/middle-truncate"
import { ExternalLink, Loader2, Trash2, UserPlus } from "lucide-react"
import { toast } from "sonner"
import { buildAddAdminTx, buildRemoveAdminTx } from "@/lib/contracts/governance/transactions"
import { getAdminList, revalidateGovernance } from "@/app/governance/actions"
import { trackEvent } from "@/lib/analytics"

export function AdminsPanel() {
  const { signAndSendTransaction, accountId, isConnected } = useNearWallet()
  const [admins, setAdmins] = useState<string[]>([])
  const [newAdmin, setNewAdmin] = useState("")
  const [txLoading, setTxLoading] = useState(false)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    getAdminList(0, 100).then((result) => setAdmins(result.admins))
  }, [])

  const loading = txLoading || isPending

  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isConnected || !accountId || !newAdmin.trim()) return

    setTxLoading(true)
    try {
      await signAndSendTransaction(buildAddAdminTx(newAdmin.trim()))
      trackEvent({ domain: "governance", action: "admin_action", adminAction: "add_admin", accountId })
      startTransition(() => {
        revalidateGovernance()
      })
      toast.success(`Added ${newAdmin.trim()} as admin`)
      setNewAdmin("")
      const result = await getAdminList(0, 100)
      setAdmins(result.admins)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Transaction failed")
    } finally {
      setTxLoading(false)
    }
  }

  const handleRemoveAdmin = async (adminId: string) => {
    if (!isConnected || !accountId) return

    setTxLoading(true)
    try {
      await signAndSendTransaction(buildRemoveAdminTx(adminId))
      trackEvent({ domain: "governance", action: "admin_action", adminAction: "remove_admin", accountId })
      startTransition(() => {
        revalidateGovernance()
      })
      toast.success(`Removed ${adminId} from admins`)
      const result = await getAdminList(0, 100)
      setAdmins(result.admins)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Transaction failed")
    } finally {
      setTxLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Add admin form */}
      <form onSubmit={handleAddAdmin} className="flex items-center gap-2">
        <Input
          value={newAdmin}
          onChange={(e) => setNewAdmin(e.target.value)}
          placeholder="account.near"
          className="flex-1 h-9 text-sm"
        />
        <Button variant="citizens-primary" size="sm" type="submit" disabled={loading || !newAdmin.trim()}>
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <UserPlus className="h-3 w-3" />}
          Add
        </Button>
      </form>

      {/* Admin list */}
      <div className="flex flex-col gap-1">
        {admins.map((admin) => (
          <div
            key={admin}
            className="flex items-center justify-between p-3 rounded-lg bg-[#f8fafc] dark:bg-white/[0.03]"
          >
            <a
              href={NEAR_CONFIG.explorerAccountUrl(admin)}
              target="_blank"
              rel="noopener noreferrer"
              className="font-inter text-[14px] text-black dark:text-white hover:underline inline-flex items-center gap-1"
            >
              <MiddleTruncate text={admin} className="max-w-[200px]" />
              <ExternalLink className="h-3 w-3 shrink-0 text-[#64748b]" />
            </a>
            <Button
              variant="citizens-outline"
              size="sm"
              onClick={() => handleRemoveAdmin(admin)}
              disabled={loading || admins.length <= 1}
              className="text-red-500 hover:text-red-700"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        ))}
        {admins.length === 0 && (
          <p className="font-inter text-[14px] text-[#828282] dark:text-neutral-400 py-4 text-center">
            No admins found.
          </p>
        )}
      </div>
    </div>
  )
}
