"use client"

import { useState, useEffect, useTransition, useCallback } from "react"
import { Button, Input } from "@near-citizens/ui"
import { NEAR_CONFIG, nearAccountIdSchema, useNearWallet } from "@/lib"
import { MiddleTruncate } from "@/components/ui/middle-truncate"
import { ExternalLink, Loader2, Trash2, UserPlus } from "lucide-react"
import { toast } from "sonner"
import { buildAddAdminTx, buildRemoveAdminTx } from "@/lib/contracts/governance/transactions"
import { extractExecutionFailure, getTransactionFailureMessage } from "@/lib/contracts/governance/vote-outcome"
import { checkIsAdmin, getAdminList, revalidateGovernance } from "@/app/proposals/actions"
import { trackEvent } from "@/lib/analytics"

export function AdminsPanel() {
  const { signAndSendTransaction, accountId, isConnected } = useNearWallet()
  const [admins, setAdmins] = useState<string[]>([])
  const [newAdmin, setNewAdmin] = useState("")
  const [txLoading, setTxLoading] = useState(false)
  const [isPending, startTransition] = useTransition()

  const refreshAdmins = useCallback(async () => {
    const result = await getAdminList(0, 100)
    setAdmins(result.admins)
  }, [])

  useEffect(() => {
    void refreshAdmins()
  }, [refreshAdmins])

  const loading = txLoading || isPending
  const normalizedNewAdmin = newAdmin.trim()
  const hasAdminInput = normalizedNewAdmin.length > 0
  const isAdminInputValid = !hasAdminInput || nearAccountIdSchema.safeParse(normalizedNewAdmin).success
  const isAdminAlreadyListed = hasAdminInput && admins.includes(normalizedNewAdmin)
  const addAdminInputError = !hasAdminInput
    ? null
    : !isAdminInputValid
      ? "Enter a valid NEAR account ID."
      : isAdminAlreadyListed
        ? "This account is already an admin."
        : null

  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isConnected || !accountId || !hasAdminInput) return
    if (!isAdminInputValid) {
      toast.error("Enter a valid NEAR account ID.")
      return
    }
    if (isAdminAlreadyListed) {
      toast.error("This account is already an admin.")
      return
    }

    setTxLoading(true)
    trackEvent({
      domain: "governance",
      action: "admin_tx_submit",
      area: "admins",
      operation: "add_admin",
      accountId,
      targetAccountId: normalizedNewAdmin,
    })
    try {
      const alreadyAdmin = await checkIsAdmin(normalizedNewAdmin)
      if (alreadyAdmin) {
        trackEvent({
          domain: "governance",
          action: "admin_tx_result",
          area: "admins",
          operation: "add_admin",
          outcome: "fail",
          accountId,
          targetAccountId: normalizedNewAdmin,
          errorMessage: "This account is already an admin.",
        })
        toast.error("This account is already an admin.")
        await refreshAdmins()
        return
      }

      const result = await signAndSendTransaction(buildAddAdminTx(normalizedNewAdmin))
      const executionFailure = extractExecutionFailure(result)
      if (executionFailure) {
        throw new Error(executionFailure)
      }

      startTransition(() => {
        revalidateGovernance()
      })
      trackEvent({
        domain: "governance",
        action: "admin_tx_result",
        area: "admins",
        operation: "add_admin",
        outcome: "success",
        accountId,
        targetAccountId: normalizedNewAdmin,
      })
      toast.success(`Added ${normalizedNewAdmin} as admin`)
      setNewAdmin("")
      await refreshAdmins()
    } catch (error) {
      const errorMessage = error instanceof Error ? getTransactionFailureMessage(error.message) : "Transaction failed"
      trackEvent({
        domain: "governance",
        action: "admin_tx_result",
        area: "admins",
        operation: "add_admin",
        outcome: "fail",
        accountId,
        targetAccountId: normalizedNewAdmin,
        errorMessage,
      })
      toast.error(errorMessage)
      await refreshAdmins()
    } finally {
      setTxLoading(false)
    }
  }

  const handleRemoveAdmin = async (adminId: string) => {
    if (!isConnected || !accountId) return

    setTxLoading(true)
    trackEvent({
      domain: "governance",
      action: "admin_tx_submit",
      area: "admins",
      operation: "remove_admin",
      accountId,
      targetAccountId: adminId,
    })
    try {
      const result = await signAndSendTransaction(buildRemoveAdminTx(adminId))
      const executionFailure = extractExecutionFailure(result)
      if (executionFailure) {
        throw new Error(executionFailure)
      }

      startTransition(() => {
        revalidateGovernance()
      })
      trackEvent({
        domain: "governance",
        action: "admin_tx_result",
        area: "admins",
        operation: "remove_admin",
        outcome: "success",
        accountId,
        targetAccountId: adminId,
      })
      toast.success(`Removed ${adminId} from admins`)
      await refreshAdmins()
    } catch (error) {
      const errorMessage = error instanceof Error ? getTransactionFailureMessage(error.message) : "Transaction failed"
      trackEvent({
        domain: "governance",
        action: "admin_tx_result",
        area: "admins",
        operation: "remove_admin",
        outcome: "fail",
        accountId,
        targetAccountId: adminId,
        errorMessage,
      })
      toast.error(errorMessage)
      await refreshAdmins()
    } finally {
      setTxLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Add admin form */}
      <div className="flex flex-col gap-1">
        <form onSubmit={handleAddAdmin} className="flex items-center gap-2">
          <Input
            value={newAdmin}
            onChange={(e) => setNewAdmin(e.target.value)}
            placeholder="account.near"
            className="flex-1 h-9 text-sm"
            aria-invalid={!!addAdminInputError}
          />
          <Button
            variant="citizens-primary"
            size="sm"
            type="submit"
            disabled={loading || !hasAdminInput || !isAdminInputValid || isAdminAlreadyListed}
          >
            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <UserPlus className="h-3 w-3" />}
            Add
          </Button>
        </form>
        {addAdminInputError && <p className="font-inter text-[12px] text-red-500 px-1">{addAdminInputError}</p>}
      </div>

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
