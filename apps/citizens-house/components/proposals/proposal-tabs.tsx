"use client"

import Link from "next/link"
import { Button } from "@near-citizens/ui"
import { type ProposalStatus } from "@near-citizens/shared"

interface ProposalTabsProps {
  currentStatus?: ProposalStatus
}

const tabs: { label: string; status?: ProposalStatus }[] = [
  { label: "All", status: undefined },
  { label: "Active", status: "Active" },
  { label: "Passed", status: "Passed" },
  { label: "Failed", status: "Failed" },
  { label: "No Quorum", status: "QuorumNotMet" },
  { label: "Cancelled", status: "Cancelled" },
]

export function ProposalTabs({ currentStatus }: ProposalTabsProps) {
  return (
    <div className="flex gap-2 mb-6 border-b">
      {tabs.map((tab) => {
        const isActive = currentStatus === tab.status
        const href = tab.status ? `/proposals?status=${tab.status}` : "/proposals"

        return (
          <Link key={tab.label} href={href}>
            <Button variant="ghost" className={`rounded-none ${isActive ? "border-b-2 border-primary" : ""}`}>
              {tab.label}
            </Button>
          </Link>
        )
      })}
    </div>
  )
}
