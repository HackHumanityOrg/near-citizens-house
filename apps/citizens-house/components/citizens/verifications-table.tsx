"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@near-citizens/ui"
import { NEAR_CONFIG } from "@/lib"
import { trackEvent } from "@/lib/analytics"
import { ChevronLeft, ChevronRight, ExternalLink } from "lucide-react"
import { VerificationDetailsDialog } from "./verification-details-dialog"
import { MiddleTruncate } from "@/components/ui/middle-truncate"
import type { VerificationWithStatus } from "@/app/citizens/actions"

interface Props {
  accounts: VerificationWithStatus[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

function formatDate(timestamp: number): string {
  // Timestamp is already in milliseconds (converted from NEAR nanoseconds in verification-contract.ts)
  // Manual formatting to avoid hydration mismatch between Node.js and browser toLocaleString
  const date = new Date(timestamp)
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
  const month = months[date.getUTCMonth()]
  const day = date.getUTCDate()
  const year = date.getUTCFullYear()
  const hours = date.getUTCHours()
  const minutes = date.getUTCMinutes().toString().padStart(2, "0")
  const ampm = hours >= 12 ? "PM" : "AM"
  const hour12 = hours % 12 || 12
  return `${month} ${day}, ${year}, ${hour12}:${minutes} ${ampm} UTC`
}

export function VerificationsTable({ accounts, total, page, pageSize: _pageSize, totalPages }: Props) {
  const [selectedAccount, setSelectedAccount] = useState<VerificationWithStatus | null>(null)

  const handleViewDetails = (account: VerificationWithStatus) => {
    trackEvent({
      domain: "citizens",
      action: "details_viewed",
      viewedAccountId: account.account.nearAccountId,
    })
    setSelectedAccount(account)
  }

  return (
    <div className="flex flex-col items-center w-full px-4 md:px-[82px]">
      {/* Table Card */}
      <div className="bg-white dark:bg-[#191a23] border border-[rgba(0,0,0,0.1)] dark:border-white/20 flex flex-col items-start rounded-[16px] w-full max-w-[1276px]">
        {/* Card Header */}
        <div className="flex flex-col gap-[8px] items-start px-[16px] py-[16px] md:px-[40px] rounded-t-[16px] w-full">
          <div className="flex items-start px-0 py-[8px]">
            <h2 className="font-fk-grotesk font-bold text-[20px] leading-[28px] text-black dark:text-white">
              Verification Records
            </h2>
          </div>
          <div className="flex flex-col gap-[8px] md:flex-row md:items-center md:justify-between w-full">
            <p
              data-testid="verification-records-count"
              className="font-fk-grotesk text-[14px] leading-[14px] text-[#090909] dark:text-neutral-300"
            >
              {accounts.length > 0
                ? `Showing ${accounts.length} of ${total} NEAR Verified Accounts`
                : "No verified accounts yet"}
            </p>
            <div className="flex items-start py-[8px] md:py-0">
              <a
                href={NEAR_CONFIG.explorerAccountUrl(NEAR_CONFIG.verificationContractId)}
                target="_blank"
                rel="noopener noreferrer"
                className="font-fk-grotesk font-medium text-[14px] md:text-[16px] leading-[28px] text-[#828282] underline hover:text-[#666666] dark:hover:text-neutral-400 transition-colors"
              >
                View contract
              </a>
            </div>
          </div>
        </div>

        {/* Table Header - Desktop only */}
        <div className="hidden md:block bg-[#e2e8f0] dark:bg-white/10 border-b border-[#cbd5e1] dark:border-white/10 px-[40px] py-[16px] w-full">
          <div className="grid items-center w-full grid-cols-[minmax(0,1fr)_180px_240px_77px] gap-[16px]">
            <span className="font-fk-grotesk font-bold text-[16px] leading-[28px] text-black dark:text-white text-left">
              NEAR Account
            </span>
            <span className="font-fk-grotesk font-bold text-[16px] leading-[28px] text-black dark:text-white text-center">
              Verification
            </span>
            <span className="font-fk-grotesk font-bold text-[16px] leading-[28px] text-black dark:text-white text-center whitespace-nowrap">
              Verified At
            </span>
            <span className="font-fk-grotesk font-bold text-[16px] leading-[28px] text-black dark:text-white text-center">
              Verify
            </span>
          </div>
        </div>

        {/* Table Body */}
        {accounts.length === 0 ? (
          <div className="flex items-center justify-center w-full py-[48px]">
            <p className="font-fk-grotesk text-[14px] md:text-[16px] text-[#828282] dark:text-neutral-400">
              No verified accounts yet. Be the first to verify!
            </p>
          </div>
        ) : (
          accounts.map(({ account, verification: _verification }, index) => {
            const isLastRow = index === accounts.length - 1
            return (
              <div
                key={account.nearAccountId}
                className={`px-[16px] py-[16px] md:px-[40px] w-full ${!isLastRow ? "border-b border-[#cbd5e1] dark:border-white/10" : ""}`}
              >
                {/* Mobile Card Layout */}
                <div className="md:hidden flex flex-col gap-[12px]">
                  <div className="min-w-0">
                    <a
                      href={NEAR_CONFIG.explorerAccountUrl(account.nearAccountId)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-fk-grotesk font-medium text-[14px] leading-[28px] text-[#040404] dark:text-white hover:underline inline-flex items-center gap-[8px] max-w-full"
                    >
                      <MiddleTruncate text={account.nearAccountId} className="min-w-0" />
                      <ExternalLink className="h-4 w-4 shrink-0 text-[#0f172a] dark:text-white/70" />
                    </a>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="bg-verified-badge-bg flex h-[32px] max-w-[180px] items-center justify-center rounded-full px-[12px] py-[6px] overflow-hidden">
                      <span className="font-poppins text-[12px] leading-[1.4] text-verified-badge-text tracking-[0.24px] text-center whitespace-nowrap truncate w-full">
                        ID Verified
                      </span>
                    </div>
                    <button
                      onClick={() => {
                        const found = accounts.find((a) => a.account.nearAccountId === account.nearAccountId)
                        if (found) handleViewDetails(found)
                      }}
                      className="bg-[#040404] dark:bg-white flex gap-[8px] h-[32px] items-center justify-center px-[14px] py-[6px] rounded-[4px]"
                    >
                      <span className="font-fk-grotesk font-bold text-[14px] leading-[20px] text-[#d8d8d8] dark:text-black">
                        Details
                      </span>
                    </button>
                  </div>
                  <p className="font-poppins text-[14px] leading-[1.4] text-black dark:text-neutral-300 tracking-[0.28px]">
                    {formatDate(account.verifiedAt)}
                  </p>
                </div>

                {/* Desktop Row Layout */}
                <div className="hidden md:grid items-center w-full grid-cols-[minmax(0,1fr)_180px_240px_77px] gap-[16px]">
                  {/* NEAR Account */}
                  <div className="min-w-0">
                    <a
                      href={NEAR_CONFIG.explorerAccountUrl(account.nearAccountId)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-fk-grotesk font-medium text-[16px] leading-[28px] text-[#040404] dark:text-white hover:underline inline-flex items-center gap-[8px] max-w-full"
                    >
                      <MiddleTruncate text={account.nearAccountId} className="min-w-0" />
                      <ExternalLink className="h-4 w-4 shrink-0 text-[#0f172a] dark:text-white/70" />
                    </a>
                  </div>

                  {/* Verification Badge */}
                  <div className="flex items-center justify-center">
                    <div className="bg-verified-badge-bg flex h-[32px] max-w-[180px] items-center justify-center rounded-full px-[12px] py-[6px] overflow-hidden">
                      <span className="font-poppins text-[12px] leading-[1.4] text-verified-badge-text tracking-[0.24px] text-center whitespace-nowrap truncate w-full">
                        ID Verified
                      </span>
                    </div>
                  </div>

                  {/* Verified At */}
                  <div className="flex items-center justify-center">
                    <p className="font-poppins text-[14px] leading-[1.4] text-black dark:text-neutral-300 tracking-[0.28px] text-center whitespace-nowrap">
                      {formatDate(account.verifiedAt)}
                    </p>
                  </div>

                  {/* Details Button */}
                  <div className="flex items-center justify-center">
                    <button
                      onClick={() => {
                        const found = accounts.find((a) => a.account.nearAccountId === account.nearAccountId)
                        if (found) handleViewDetails(found)
                      }}
                      className="bg-[#040404] dark:bg-white flex gap-[8px] h-[32px] items-center justify-center px-[14px] py-[6px] rounded-[4px] hover:bg-[#1a1a1a] dark:hover:bg-neutral-200 transition-colors"
                    >
                      <span className="font-fk-grotesk font-bold text-[14px] leading-[20px] text-[#d8d8d8] dark:text-black">
                        Details
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex flex-col gap-3 items-center md:flex-row md:justify-between mt-6 md:mt-[24px] w-full max-w-[1276px]">
          <p className="font-fk-grotesk text-[12px] md:text-[14px] leading-[14px] text-[#828282] dark:text-neutral-400 order-2 md:order-1">
            Page {page + 1} of {totalPages}
          </p>
          <div className="flex gap-3 order-1 md:order-2">
            {page > 0 ? (
              <Button variant="citizens-outline" size="citizens-lg" asChild>
                <Link href={`/citizens?page=${page - 1}`}>
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
                <Link href={`/citizens?page=${page + 1}`}>
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
      {/* Details Dialog */}
      <VerificationDetailsDialog
        data={selectedAccount}
        open={!!selectedAccount}
        onOpenChange={(open) => !open && setSelectedAccount(null)}
      />
    </div>
  )
}
