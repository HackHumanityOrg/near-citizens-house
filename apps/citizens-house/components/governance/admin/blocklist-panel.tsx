"use client"

import { useState, useEffect, useCallback } from "react"
import { Button, Input } from "@near-citizens/ui"
import { NEAR_CONFIG, nearAccountIdSchema, useNearWallet } from "@/lib"
import { MiddleTruncate } from "@/components/ui/middle-truncate"
import { ExternalLink, Loader2, Trash2, ShieldBan, Lock } from "lucide-react"
import { toast } from "sonner"
import { buildBlocklistAccountTx, buildUnblocklistAccountTx } from "@/lib/contracts/governance/transactions"
import { extractExecutionFailure, getTransactionFailureMessage } from "@/lib/contracts/governance/vote-outcome"
import { trackEvent } from "@/lib/analytics"
import {
  checkIsBlocklisted,
  getBlocklist,
  getBlocklistLockInfo,
  invalidateGovernanceCache,
  type BlocklistLockInfo,
} from "@/app/proposals/actions"

export function BlocklistPanel() {
  const { signAndSendTransaction, accountId, isConnected } = useNearWallet()
  const [accounts, setAccounts] = useState<string[]>([])
  const [lockInfo, setLockInfo] = useState<BlocklistLockInfo | null>(null)
  const [newAccount, setNewAccount] = useState("")
  const [txLoading, setTxLoading] = useState(false)

  const refreshBlocklistState = useCallback(async () => {
    const [result, info] = await Promise.all([getBlocklist(0, 100), getBlocklistLockInfo()])
    setAccounts(result.accounts)
    setLockInfo(info)
  }, [])

  const isLocked = lockInfo?.locked ?? false

  useEffect(() => {
    void refreshBlocklistState()
  }, [refreshBlocklistState])

  const loading = txLoading
  const normalizedNewAccount = newAccount.trim()
  const hasAccountInput = normalizedNewAccount.length > 0
  const isAccountInputValid = !hasAccountInput || nearAccountIdSchema.safeParse(normalizedNewAccount).success
  const isAccountAlreadyListed = hasAccountInput && accounts.includes(normalizedNewAccount)
  const addBlocklistInputError = !hasAccountInput
    ? null
    : !isAccountInputValid
      ? "Enter a valid NEAR account ID."
      : isAccountAlreadyListed
        ? "This account is already blocklisted."
        : null

  const handleAdd = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!isConnected || !accountId || !hasAccountInput) return
    if (isLocked) {
      toast.error("Blocklist is locked while governance proposals are pending or active.")
      return
    }
    if (!isAccountInputValid) {
      toast.error("Enter a valid NEAR account ID.")
      return
    }
    if (isAccountAlreadyListed) {
      toast.error("This account is already blocklisted.")
      return
    }

    setTxLoading(true)
    trackEvent({
      domain: "governance",
      action: "admin_tx_submit",
      area: "blocklist",
      operation: "add_blocklist",
      accountId,
      targetAccountId: normalizedNewAccount,
    })
    try {
      const alreadyBlocklisted = await checkIsBlocklisted(normalizedNewAccount)
      if (alreadyBlocklisted) {
        trackEvent({
          domain: "governance",
          action: "admin_tx_result",
          area: "blocklist",
          operation: "add_blocklist",
          outcome: "fail",
          accountId,
          targetAccountId: normalizedNewAccount,
          errorMessage: "This account is already blocklisted.",
        })
        toast.error("This account is already blocklisted.")
        await refreshBlocklistState()
        return
      }

      const result = await signAndSendTransaction(buildBlocklistAccountTx(normalizedNewAccount))
      const executionFailure = extractExecutionFailure(result)
      if (executionFailure) {
        throw new Error(executionFailure)
      }

      await invalidateGovernanceCache({ op: "blocklist_update", accountId })
      trackEvent({
        domain: "governance",
        action: "admin_tx_result",
        area: "blocklist",
        operation: "add_blocklist",
        outcome: "success",
        accountId,
        targetAccountId: normalizedNewAccount,
      })
      toast.success(`Blocklisted ${normalizedNewAccount}`)
      setNewAccount("")
      await refreshBlocklistState()
    } catch (error) {
      const errorMessage = error instanceof Error ? getTransactionFailureMessage(error.message) : "Transaction failed"
      trackEvent({
        domain: "governance",
        action: "admin_tx_result",
        area: "blocklist",
        operation: "add_blocklist",
        outcome: "fail",
        accountId,
        targetAccountId: normalizedNewAccount,
        errorMessage,
      })
      toast.error(errorMessage)
      await refreshBlocklistState()
    } finally {
      setTxLoading(false)
    }
  }

  const handleRemove = async (target: string) => {
    if (!isConnected || !accountId) return

    setTxLoading(true)
    trackEvent({
      domain: "governance",
      action: "admin_tx_submit",
      area: "blocklist",
      operation: "remove_blocklist",
      accountId,
      targetAccountId: target,
    })
    try {
      const result = await signAndSendTransaction(buildUnblocklistAccountTx(target))
      const executionFailure = extractExecutionFailure(result)
      if (executionFailure) {
        throw new Error(executionFailure)
      }

      await invalidateGovernanceCache({ op: "blocklist_update", accountId })
      trackEvent({
        domain: "governance",
        action: "admin_tx_result",
        area: "blocklist",
        operation: "remove_blocklist",
        outcome: "success",
        accountId,
        targetAccountId: target,
      })
      toast.success(`Removed ${target} from blocklist`)
      await refreshBlocklistState()
    } catch (error) {
      const errorMessage = error instanceof Error ? getTransactionFailureMessage(error.message) : "Transaction failed"
      trackEvent({
        domain: "governance",
        action: "admin_tx_result",
        area: "blocklist",
        operation: "remove_blocklist",
        outcome: "fail",
        accountId,
        targetAccountId: target,
        errorMessage,
      })
      toast.error(errorMessage)
      await refreshBlocklistState()
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

      <div className="flex flex-col gap-1">
        <form onSubmit={handleAdd} className="flex items-center gap-2">
          <Input
            value={newAccount}
            onChange={(e) => setNewAccount(e.target.value)}
            placeholder="account.near"
            className="flex-1 h-9 text-sm"
            disabled={isLocked}
            aria-invalid={!!addBlocklistInputError}
          />
          <Button
            variant="citizens-primary"
            size="sm"
            type="submit"
            disabled={loading || !hasAccountInput || !isAccountInputValid || isAccountAlreadyListed || isLocked}
          >
            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <ShieldBan className="h-3 w-3" />}
            Add
          </Button>
        </form>
        {addBlocklistInputError && <p className="font-inter text-[12px] text-red-500 px-1">{addBlocklistInputError}</p>}
      </div>

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
