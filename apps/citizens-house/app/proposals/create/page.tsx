"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useNearWallet } from "@/lib"
import { Loader2 } from "lucide-react"
import { Button } from "@near-citizens/ui"
import { checkIsAdmin, getGovernanceConfig } from "../actions"
import { CreateProposalForm } from "@/components/governance/admin/create-proposal-form"
import type { GovernanceConfig } from "@/lib/schemas/governance-contract"

export default function CreateProposalPage() {
  const router = useRouter()
  const { accountId, isConnected, connect, isLoading } = useNearWallet()
  const [adminCheck, setAdminCheck] = useState<{ accountId: string; isAdmin: boolean } | null>(null)
  const [config, setConfig] = useState<GovernanceConfig | null>(null)

  useEffect(() => {
    if (!isConnected || !accountId) return
    Promise.all([checkIsAdmin(accountId), getGovernanceConfig()]).then(([admin, cfg]) => {
      setAdminCheck({ accountId, isAdmin: admin })
      setConfig(cfg)
      if (!admin) router.replace("/proposals")
    })
  }, [isConnected, accountId, router])

  // Derive admin status from check result, accounting for account changes
  const isAdmin = adminCheck?.accountId === accountId ? adminCheck.isAdmin : null
  const adminLoading = isConnected && accountId && isAdmin === null

  if (isLoading || adminLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-6 w-6 animate-spin text-[#64748b]" />
      </div>
    )
  }

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <p className="font-fk-grotesk text-[16px] text-[#64748b] dark:text-[#94a3b8]">
          Connect your wallet to create a proposal.
        </p>
        <Button variant="citizens-primary" size="citizens-lg" onClick={connect}>
          Connect Wallet
        </Button>
      </div>
    )
  }

  if (isAdmin === false) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="font-fk-grotesk text-[16px] text-[#64748b] dark:text-[#94a3b8]">
          Only admins can create proposals.
        </p>
      </div>
    )
  }

  return (
    <div className="w-full px-4 md:px-[82px] py-8 md:py-12">
      <div className="flex flex-col items-center gap-8">
        <h1 className="font-fk-grotesk font-medium text-[28px] md:text-[36px] leading-[32px] md:leading-[40px] text-black dark:text-white">
          Create Proposal
        </h1>
        {config && (
          <CreateProposalForm
            minProposalBond={config.minProposalBond}
            votingPeriodSecs={config.votingPeriodSecs}
            maxStartDelaySecs={config.maxStartDelaySecs}
          />
        )}
      </div>
    </div>
  )
}
