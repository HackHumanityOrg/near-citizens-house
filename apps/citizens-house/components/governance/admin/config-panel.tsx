"use client"

import { useState, useEffect } from "react"
import { Button, Input, Label } from "@near-citizens/ui"
import { useNearWallet } from "@/lib"
import { Loader2, Pencil, X } from "lucide-react"
import { toast } from "sonner"
import type { GovernanceConfig } from "@/lib/schemas/governance-contract"
import { yoctoToNear, nearToYocto } from "@/lib/schemas/governance-contract"
import { trackEvent } from "@/lib/analytics"
import {
  buildUpdateQuorumBpsTx,
  buildUpdateVotingPeriodSecsTx,
  buildUpdatePendingExpirySecsTx,
  buildUpdateMinProposalBondTx,
  buildUpdateFinalizeGracePeriodSecsTx,
  buildUpdateMaxStartDelaySecsTx,
  buildUpdateVerifiedAccountsContractTx,
} from "@/lib/contracts/governance/transactions"
import { getGovernanceConfig, invalidateGovernanceCache } from "@/app/proposals/actions"

function secsToDisplay(secs: number): string {
  if (secs < 3600) return `${Math.round(secs / 60)} minutes`
  if (secs < 86400) return `${Math.round(secs / 3600)} hours`
  return `${Math.round(secs / 86400)} days`
}

export function ConfigPanel() {
  const { signAndSendTransaction, accountId, isConnected } = useNearWallet()
  const [config, setConfig] = useState<GovernanceConfig | null>(null)
  const [editingField, setEditingField] = useState<string | null>(null)
  const [editValue, setEditValue] = useState("")
  const [txLoading, setTxLoading] = useState(false)

  useEffect(() => {
    getGovernanceConfig().then(setConfig)
  }, [])

  const handleUpdate = async (field: string) => {
    if (!isConnected || !accountId || !editValue.trim()) return

    setTxLoading(true)
    const operation = `update_${field}`
    trackEvent({
      domain: "governance",
      action: "admin_tx_submit",
      area: "config",
      operation,
      accountId,
    })
    try {
      const txBuilders: Record<string, () => ReturnType<typeof buildUpdateQuorumBpsTx>> = {
        quorumBps: () => buildUpdateQuorumBpsTx(parseInt(editValue)),
        votingPeriodSecs: () => buildUpdateVotingPeriodSecsTx(parseInt(editValue)),
        pendingExpirySecs: () => buildUpdatePendingExpirySecsTx(parseInt(editValue)),
        minProposalBond: () => buildUpdateMinProposalBondTx(nearToYocto(editValue)),
        finalizeGracePeriodSecs: () => buildUpdateFinalizeGracePeriodSecsTx(parseInt(editValue)),
        maxStartDelaySecs: () => buildUpdateMaxStartDelaySecsTx(parseInt(editValue)),
        verifiedAccountsContract: () => buildUpdateVerifiedAccountsContractTx(editValue.trim()),
      }

      const builder = txBuilders[field]
      if (!builder) return

      await signAndSendTransaction(builder())
      await invalidateGovernanceCache({ op: "config_update", accountId })
      trackEvent({
        domain: "governance",
        action: "admin_tx_result",
        area: "config",
        operation,
        outcome: "success",
        accountId,
      })
      toast.success("Configuration updated")
      setEditingField(null)
      // Refresh config
      const newConfig = await getGovernanceConfig()
      setConfig(newConfig)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Transaction failed"
      trackEvent({
        domain: "governance",
        action: "admin_tx_result",
        area: "config",
        operation,
        outcome: "fail",
        accountId,
        errorMessage,
      })
      toast.error(errorMessage)
    } finally {
      setTxLoading(false)
    }
  }

  const loading = txLoading

  if (!config) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-[#64748b]" />
      </div>
    )
  }

  const fields = [
    {
      key: "quorumBps",
      label: "Quorum",
      description:
        "Minimum percentage of verified accounts that must vote for a proposal to be valid. Can be updated anytime — each proposal snapshots its quorum at creation.",
      value: `${config.quorumBps / 100}%`,
      placeholder: "Basis points (e.g. 700 for 7%)",
    },
    {
      key: "votingPeriodSecs",
      label: "Voting Period",
      description:
        "How long voting stays open after a proposal starts. Can be updated anytime — existing proposals keep their original end time.",
      value: secsToDisplay(config.votingPeriodSecs),
      placeholder: "Seconds (e.g. 1209600 for 14 days)",
    },
    {
      key: "pendingExpirySecs",
      label: "Pending Expiry",
      description:
        "How long a proposal can stay in Pending state (waiting for snapshot callback) before an admin can expire it. Can be updated anytime — each proposal snapshots its expiry at creation.",
      value: secsToDisplay(config.pendingExpirySecs),
      placeholder: "Seconds (e.g. 3600 for 1 hour)",
    },
    {
      key: "minProposalBond",
      label: "Min Proposal Bond",
      description:
        "Minimum NEAR that must be attached when creating a proposal. The bond is non-refundable and covers storage costs. Can be updated anytime — only affects future proposals.",
      value: `${yoctoToNear(config.minProposalBond)} NEAR`,
      placeholder: "NEAR (e.g. 1 for 1 NEAR)",
    },
    {
      key: "finalizeGracePeriodSecs",
      label: "Finalize Grace Period",
      description:
        "After voting ends, how long to wait for pending vote callbacks before allowing finalization anyway. Checked dynamically at finalize time, so changes take effect immediately.",
      value: secsToDisplay(config.finalizeGracePeriodSecs),
      placeholder: "Seconds (e.g. 3600 for 1 hour)",
    },
    {
      key: "maxStartDelaySecs",
      label: "Max Start Delay",
      description:
        "Maximum time between proposal creation and voting start. Allows scheduling proposals to start in the future. Can be updated anytime — only affects future proposals.",
      value: secsToDisplay(config.maxStartDelaySecs),
      placeholder: "Seconds (e.g. 7776000 for 90 days)",
    },
    {
      key: "verifiedAccountsContract",
      label: "Verified Accounts Contract",
      description:
        "The contract used for verification eligibility checks and voter snapshots. Blocked while any proposal is Pending or Active.",
      value: config.verifiedAccountsContract,
      placeholder: "e.g. verified.near",
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      {fields.map(({ key, label, description, value, placeholder }) => (
        <div key={key} className="flex flex-col gap-1 p-3 rounded-lg bg-[#f8fafc] dark:bg-white/[0.03]">
          <Label className="font-fk-grotesk text-[13px] text-[#334155] dark:text-[#cbd5e1]">{label}</Label>
          <p className="font-inter text-[12px] leading-[18px] text-[#64748b] dark:text-[#94a3b8]">{description}</p>
          {editingField === key ? (
            <div className="flex items-center gap-2">
              <Input
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                placeholder={placeholder}
                className="flex-1 h-8 text-sm"
              />
              <Button size="sm" variant="citizens-primary" onClick={() => handleUpdate(key)} disabled={loading}>
                {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save"}
              </Button>
              <Button size="sm" variant="citizens-outline" onClick={() => setEditingField(null)} disabled={loading}>
                <X className="h-3 w-3" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <span className="font-inter text-[14px] text-black dark:text-white">{value}</span>
              <button
                onClick={() => {
                  setEditingField(key)
                  setEditValue("")
                }}
                className="p-1 text-[#64748b] hover:text-black dark:hover:text-white transition-colors"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
