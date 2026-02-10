"use client"

import Link from "next/link"
import { Button } from "@near-citizens/ui"
import { NEAR_CONFIG } from "@/lib"
import { ChevronLeft, ChevronRight } from "lucide-react"
import type { ProposalView } from "@/lib/schemas/governance-contract"
import { ProposalCard } from "./proposal-card"

interface Props {
  proposals: ProposalView[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export function ProposalsList({ proposals, total, page, pageSize: _pageSize, totalPages }: Props) {
  const contractId = NEAR_CONFIG.governanceContractId

  return (
    <div className="flex flex-col items-center w-full px-4 md:px-[82px]">
      <div className="bg-white dark:bg-[#191a23] border border-[rgba(0,0,0,0.1)] dark:border-white/20 flex flex-col items-start rounded-[16px] w-full max-w-[1276px]">
        {/* Card Header */}
        <div className="flex flex-col gap-2 items-start px-4 py-4 md:px-10 rounded-t-[16px] w-full">
          <div className="flex items-start px-0 py-2">
            <h2 className="font-fk-grotesk font-bold text-[20px] leading-[28px] text-black dark:text-white">
              Proposals
            </h2>
          </div>
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between w-full">
            <p className="font-fk-grotesk text-[14px] leading-[14px] text-[#090909] dark:text-neutral-300">
              {proposals.length > 0 ? `Showing ${proposals.length} of ${total} proposals` : "No proposals yet"}
            </p>
            {contractId && (
              <a
                href={NEAR_CONFIG.explorerAccountUrl(contractId)}
                target="_blank"
                rel="noopener noreferrer"
                className="font-fk-grotesk font-medium text-[14px] md:text-[16px] leading-[28px] text-[#828282] underline hover:text-[#666666] dark:hover:text-neutral-400 transition-colors"
              >
                View contract
              </a>
            )}
          </div>
        </div>

        {/* Table Header - Desktop */}
        <div className="hidden md:block bg-[#e2e8f0] dark:bg-white/10 border-b border-[#cbd5e1] dark:border-white/10 px-10 py-4 w-full">
          <div className="grid grid-cols-[minmax(0,1fr)_120px_140px_140px] gap-4 items-center">
            <span className="font-fk-grotesk font-bold text-[16px] leading-[28px] text-black dark:text-white">
              Title
            </span>
            <span className="font-fk-grotesk font-bold text-[16px] leading-[28px] text-black dark:text-white text-center">
              Status
            </span>
            <span className="font-fk-grotesk font-bold text-[16px] leading-[28px] text-black dark:text-white text-center">
              Votes
            </span>
            <span className="font-fk-grotesk font-bold text-[16px] leading-[28px] text-black dark:text-white text-center">
              Time
            </span>
          </div>
        </div>

        {/* Proposals */}
        {proposals.length === 0 ? (
          <div className="flex items-center justify-center w-full py-12">
            <p className="font-fk-grotesk text-[14px] md:text-[16px] text-[#828282] dark:text-neutral-400">
              No proposals yet.
            </p>
          </div>
        ) : (
          proposals.map((proposal, index) => (
            <div
              key={proposal.id}
              className={`w-full hover:bg-[#f8fafc] dark:hover:bg-white/[0.02] transition-colors ${
                index !== proposals.length - 1 ? "border-b border-[#cbd5e1] dark:border-white/10" : ""
              }`}
            >
              <ProposalCard proposal={proposal} />
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex flex-col gap-3 items-center md:flex-row md:justify-between mt-6 w-full max-w-[1276px]">
          <p className="font-fk-grotesk text-[12px] md:text-[14px] leading-[14px] text-[#828282] dark:text-neutral-400 order-2 md:order-1">
            Page {page + 1} of {totalPages}
          </p>
          <div className="flex gap-3 order-1 md:order-2">
            {page > 0 ? (
              <Button variant="citizens-outline" size="citizens-lg" asChild>
                <Link href={`/governance?page=${page - 1}`}>
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Link>
              </Button>
            ) : (
              <Button variant="citizens-outline" size="citizens-lg" disabled>
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
            )}
            {page < totalPages - 1 ? (
              <Button variant="citizens-outline" size="citizens-lg" asChild>
                <Link href={`/governance?page=${page + 1}`}>
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </Button>
            ) : (
              <Button variant="citizens-outline" size="citizens-lg" disabled>
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
