"use client"

import { useEffect, useState } from "react"
import { useNearWallet } from "@/lib"
import { checkIsAdmin } from "../actions"
import type { ProposalView, VoteView } from "@/lib/schemas/governance-contract"
import { VotePanel } from "@/components/governance/vote-panel"
import { VotesTable } from "@/components/governance/votes-table"
import {
  ProposalHeader,
  ProposalDescription,
  VotingProgressCard,
  ProposalTimeline,
  FinalizeButton,
  ProposalAdminActions,
} from "@/components/governance/proposal-detail"

interface Props {
  proposal: ProposalView
  proposalId: number
  initialVotes: VoteView[]
  totalVotes: number
}

export function ProposalPageLayout({ proposal, proposalId, initialVotes, totalVotes }: Props) {
  const { accountId, isConnected } = useNearWallet()
  const [adminCheck, setAdminCheck] = useState<{ accountId: string; isAdmin: boolean } | null>(null)

  useEffect(() => {
    if (!isConnected || !accountId) return
    checkIsAdmin(accountId).then((admin) => {
      setAdminCheck({ accountId, isAdmin: admin })
    })
  }, [isConnected, accountId])

  const isAdmin = adminCheck?.accountId === accountId ? adminCheck.isAdmin : false

  return (
    <div className="flex flex-col gap-6 lg:gap-8 max-w-[1140px] mx-auto">
      {/* Full-width header */}
      <ProposalHeader proposal={proposal} />

      {/* Two-column body: sidebar first on mobile (flex-col-reverse) */}
      <div className="flex flex-col-reverse lg:flex-row lg:gap-8 gap-6 lg:items-start">
        {/* Left column: description */}
        <div className="flex-1 min-w-0">
          <ProposalDescription proposal={proposal} />
        </div>

        {/* Right column: sidebar (sticky on desktop) */}
        <div className="w-full lg:w-[380px] lg:shrink-0">
          <div className="lg:sticky lg:top-8 flex flex-col gap-6">
            <VotePanel proposal={proposal} />
            <VotingProgressCard proposal={proposal} />
            <ProposalTimeline proposal={proposal} />
            <FinalizeButton proposal={proposal} />
            {isAdmin && <ProposalAdminActions proposal={proposal} />}
          </div>
        </div>
      </div>

      {/* Full-width votes table */}
      <VotesTable proposalId={proposalId} initialVotes={initialVotes} totalVotes={totalVotes} />
    </div>
  )
}
