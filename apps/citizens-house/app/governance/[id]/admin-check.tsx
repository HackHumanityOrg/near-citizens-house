"use client"

import { useEffect, useState } from "react"
import { useNearWallet } from "@/lib"
import { checkIsAdmin } from "../actions"
import { ProposalDetail } from "@/components/governance/proposal-detail"
import type { ProposalView } from "@/lib/schemas/governance-contract"

interface Props {
  proposal: ProposalView
}

export function ProposalWithAdmin({ proposal }: Props) {
  const { accountId, isConnected } = useNearWallet()
  const [adminCheck, setAdminCheck] = useState<{ accountId: string; isAdmin: boolean } | null>(null)

  useEffect(() => {
    if (!isConnected || !accountId) return
    checkIsAdmin(accountId).then((admin) => {
      setAdminCheck({ accountId, isAdmin: admin })
    })
  }, [isConnected, accountId])

  const isAdmin = adminCheck?.accountId === accountId ? adminCheck.isAdmin : false

  return <ProposalDetail proposal={proposal} isAdmin={isAdmin} />
}
