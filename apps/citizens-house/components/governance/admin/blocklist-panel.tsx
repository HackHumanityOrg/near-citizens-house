"use client"

import { useState, useEffect, useTransition } from "react"
import { Button, Input } from "@near-citizens/ui"
import { NEAR_CONFIG, useNearWallet } from "@/lib"
import { MiddleTruncate } from "@/components/ui/middle-truncate"
import { ExternalLink, Loader2, Trash2, ShieldBan, Lock } from "lucide-react"
import { toast } from "sonner"
import { buildBlocklistAccountTx, buildUnblocklistAccountTx } from "@/lib/contracts/governance/transactions"
import {
  getBlocklist,
  getBlocklistLockInfo,
  revalidateGovernance,
  type BlocklistLockInfo,
} from "@/app/governance/actions"
import { trackEvent } from "@/lib/analytics"

export function BlocklistPanel() {
  const { signAndSendTransaction, accountId, isConnected } = useNearWallet()
  const [accounts, setAccounts] = useState<string[]>([])
  const [lockInfo, setLockInfo] = useState<BlocklistLockInfo | null>(null)
  const [newAccount, setNewAccount] = useState("")
  const [txLoading, setTxLoading] = useState(false)
  const [isPending, startTransition] = useTransition()

  const isLocked = lockInfo?.locked ?? false

  useEffect(() => {
    Promise.all([getBlocklist(0, 100), getBlocklistLockInfo()]).then(([result, info]) => {
      setAccounts(result.accounts)
      setLockInfo(info)
    })
  }, [])

  const loading = txLoading || isPending

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isConnected || !accountId || !newAccount.trim()) return

    setTxLoading(true)
    try {
      await signAndSendTransaction(buildBlocklistAccountTx(newAccount.trim()))
      trackEvent({ domain: "governance", action: "admin_action", adminAction: "blocklist_add", accountId })
      startTransition(() => {
        revalidateGovernance()
      })
      toast.success(`Blocklisted ${newAccount.trim()}`)
      setNewAccount("")
      const result = await getBlocklist(0, 100)
      setAccounts(result.accounts)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Transaction failed")
    } finally {
      setTxLoading(false)
    }
  }

  const handleRemove = async (target: string) => {
    if (!isConnected || !accountId) return

    setTxLoading(true)
    try {
      await signAndSendTransaction(buildUnblocklistAccountTx(target))
      trackEvent({ domain: "governance", action: "admin_action", adminAction: "blocklist_remove", accountId })
      startTransition(() => {
        revalidateGovernance()
      })
      toast.success(`Removed ${target} from blocklist`)
      const result = await getBlocklist(0, 100)
      setAccounts(result.accounts)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Transaction failed")
    } finally {
      setTxLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {isLocked && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-[#fef3c7] dark:bg-[#78350f]/20 text-[#92400e] dark:text-[#fbbf24]">
          <Lock className="h-4 w-4 shrink-0" />
          <span className="font-inter text-[13px]">
            {lockInfo?.hasActiveProposals
              ? "Blocklist is locked while governance proposals are pending or active."
              : "Blocklist is locked. A pending blocklist operation is in progress."}
          </span>
        </div>
      )}

      <form onSubmit={handleAdd} className="flex items-center gap-2">
        <Input
          value={newAccount}
          onChange={(e) => setNewAccount(e.target.value)}
          placeholder="account.near"
          className="flex-1 h-9 text-sm"
          disabled={isLocked}
        />
        <Button variant="citizens-primary" size="sm" type="submit" disabled={loading || !newAccount.trim() || isLocked}>
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <ShieldBan className="h-3 w-3" />}
          Add
        </Button>
      </form>

      <div className="flex flex-col gap-1">
        {accounts.map((account) => (
          <div
            key={account}
            className="flex items-center justify-between p-3 rounded-lg bg-[#f8fafc] dark:bg-white/[0.03]"
          >
            <a
              href={NEAR_CONFIG.explorerAccountUrl(account)}
              target="_blank"
              rel="noopener noreferrer"
              className="font-inter text-[14px] text-black dark:text-white hover:underline inline-flex items-center gap-1"
            >
              <MiddleTruncate text={account} className="max-w-[200px]" />
              <ExternalLink className="h-3 w-3 shrink-0 text-[#64748b]" />
            </a>
            <Button
              variant="citizens-outline"
              size="sm"
              onClick={() => handleRemove(account)}
              disabled={loading || isLocked}
              className="text-red-500 hover:text-red-700"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        ))}
        {accounts.length === 0 && (
          <p className="font-inter text-[14px] text-[#828282] dark:text-neutral-400 py-4 text-center">
            No blocklisted accounts.
          </p>
        )}
      </div>
    </div>
  )
}
