"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { useAnalytics } from "@/lib/analytics"
import { Button, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@near-citizens/ui"
import { NEAR_CONFIG } from "@near-citizens/shared"
import { ChevronLeft, ChevronRight, ExternalLink } from "lucide-react"
import { VerificationDetailsDialog } from "./verification-details-dialog"
import type { VerificationWithStatus } from "@/app/citizens/actions"

interface Props {
  accounts: VerificationWithStatus[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

function truncate(str: string, maxLength: number = 16): string {
  if (str.length <= maxLength) return str
  return str.slice(0, maxLength / 2) + "..." + str.slice(-maxLength / 2)
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

function getAttestationType(id: string): string {
  const types: Record<string, string> = {
    "1": "Passport",
    "2": "Biometric ID",
    "3": "Aadhaar",
  }
  return types[id] || `Type ${id}`
}

export function VerificationsTable({ accounts, total, page, pageSize: _pageSize, totalPages }: Props) {
  const analytics = useAnalytics()
  const [selectedAccount, setSelectedAccount] = useState<VerificationWithStatus | null>(null)
  const trackedPageRef = useRef<number | null>(null)

  // Track page view
  useEffect(() => {
    if (trackedPageRef.current !== page) {
      analytics.trackVerificationsViewed(page)
      trackedPageRef.current = page
    }
  }, [page, analytics])

  const handleViewDetails = (account: VerificationWithStatus) => {
    analytics.trackAccountDetailsViewed(account.account.nearAccountId)
    setSelectedAccount(account)
  }

  return (
    <TooltipProvider>
      <div className="flex flex-col gap-[24px] items-center w-full">
        {/* Page Title Section */}
        <div className="flex flex-col items-center w-full px-4 md:px-0">
          <h1
            className="text-[28px] leading-[32px] md:text-[44px] md:leading-[48px] text-center text-foreground"
            style={{ fontFamily: "'FK Grotesk Variable', sans-serif", fontWeight: 500 }}
          >
            Citizens
          </h1>
        </div>

        {/* Subtitle */}
        <div className="flex items-center justify-center w-full px-4 md:px-0">
          <p
            className="text-[16px] leading-[24px] md:text-[28px] md:leading-[36px] text-foreground text-center"
            style={{ fontFamily: "'FK Grotesk Variable', sans-serif", fontWeight: 400 }}
          >
            All NEAR accounts verified through Self.xyz passport proofs
          </p>
        </div>

        {/* Table Card */}
        <div className="flex flex-col items-center pt-[40px] pb-[80px] w-full">
          <div className="flex flex-col items-center w-full">
            <div className="bg-secondary/50 flex flex-col items-start rounded-none md:rounded-[16px] w-full max-w-[1276px] md:mx-auto">
              {/* Card Header */}
              <div className="bg-secondary flex flex-col gap-[8px] items-start px-4 py-3 md:px-[40px] md:py-[16px] rounded-none md:rounded-tl-[16px] md:rounded-tr-[16px] w-full">
                <div className="flex items-start px-0 py-[8px]">
                  <p
                    className="text-[18px] leading-[24px] md:text-[22px] md:leading-[28px] text-foreground"
                    style={{ fontFamily: "'FK Grotesk Variable', sans-serif", fontWeight: 500 }}
                  >
                    Verification Records
                  </p>
                </div>
                <div className="flex flex-col items-start gap-2 md:flex-row md:items-center md:justify-between w-full">
                  <p
                    className="text-[12px] md:text-[14px] leading-[1.4] text-foreground"
                    style={{ fontFamily: "Inter, sans-serif", fontWeight: 400 }}
                  >
                    {accounts.length > 0
                      ? `Showing ${accounts.length} of ${total} verified accounts`
                      : "No verified accounts yet"}
                  </p>
                  <div className="flex items-start px-0 py-0 md:py-[8px]">
                    <a
                      href={NEAR_CONFIG.explorerAccountUrl(NEAR_CONFIG.verificationContractId)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[14px] md:text-[16px] leading-[24px] text-muted-foreground underline hover:text-foreground transition-colors"
                      style={{ fontFamily: "'FK Grotesk Variable', sans-serif", fontWeight: 500 }}
                    >
                      View contract on NearBlocks
                    </a>
                  </div>
                </div>
              </div>

              {/* Table Header - Hidden on mobile */}
              <div className="hidden md:block bg-secondary border-b border-border px-[40px] py-[16px] w-full">
                <div className="grid grid-cols-[1fr_150px_220px_100px] items-center gap-4">
                  <p
                    className="text-[16px] leading-[24px] text-foreground text-left"
                    style={{ fontFamily: "'FK Grotesk Variable', sans-serif", fontWeight: 500 }}
                  >
                    NEAR Account
                  </p>
                  <p
                    className="text-[16px] leading-[24px] text-foreground text-center"
                    style={{ fontFamily: "'FK Grotesk Variable', sans-serif", fontWeight: 500 }}
                  >
                    Attestation Type
                  </p>
                  <p
                    className="text-[14px] leading-[1.4] text-foreground text-center"
                    style={{ fontFamily: "Inter, sans-serif", fontWeight: 700 }}
                  >
                    Verified At
                  </p>
                  <p
                    className="text-[16px] leading-[1.4] text-foreground text-right"
                    style={{ fontFamily: "Inter, sans-serif", fontWeight: 700 }}
                  >
                    Verify
                  </p>
                </div>
              </div>

              {/* Table Body */}
              {accounts.length === 0 ? (
                <div className="flex items-center justify-center w-full py-[48px]">
                  <p
                    className="text-[14px] md:text-[16px] text-muted-foreground"
                    style={{ fontFamily: "Inter, sans-serif" }}
                  >
                    No verified accounts yet. Be the first to verify!
                  </p>
                </div>
              ) : (
                accounts.map(({ account, verification: _verification }, index) => {
                  const isLastRow = index === accounts.length - 1
                  return (
                    <div
                      key={account.nearAccountId}
                      className={`px-4 py-3 md:px-[40px] md:py-[16px] w-full ${!isLastRow ? "border-b border-border" : ""}`}
                    >
                      {/* Mobile Card Layout */}
                      <div className="md:hidden flex flex-col gap-3">
                        <a
                          href={NEAR_CONFIG.explorerAccountUrl(account.nearAccountId)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[14px] leading-[1.3] text-foreground tracking-[0.28px] hover:underline inline-flex items-center gap-[6px]"
                          style={{ fontFamily: "Inter, sans-serif", fontWeight: 600 }}
                        >
                          {account.nearAccountId}
                          <ExternalLink className="h-3.5 w-3.5 text-[#00ec97]" />
                        </a>
                        <div className="flex items-center justify-between">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="bg-[#79d1ac] flex h-[28px] items-center px-[8px] rounded-full cursor-pointer">
                                <span
                                  className="text-[11px] leading-[1.4] text-[#002716] tracking-[0.22px]"
                                  style={{ fontFamily: "Poppins, sans-serif", fontWeight: 400 }}
                                >
                                  {getAttestationType(account.attestationId)}
                                </span>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent
                              side="top"
                              className="bg-[#1c1c1c] text-[#fcfaf7] rounded-[8px] px-[12px] py-[6px] text-[12px] leading-[1.4]"
                              style={{ fontFamily: "'FK Grotesk Variable', sans-serif", fontWeight: 400 }}
                            >
                              Nullifier: {truncate(account.nullifier, 16)}
                            </TooltipContent>
                          </Tooltip>
                          <Button
                            variant="citizens-primary"
                            size="citizens-sm"
                            onClick={() => {
                              const found = accounts.find((a) => a.account.nearAccountId === account.nearAccountId)
                              if (found) handleViewDetails(found)
                            }}
                          >
                            Details
                          </Button>
                        </div>
                        <p
                          className="text-[12px] leading-[1.4] text-muted-foreground tracking-[0.24px]"
                          style={{ fontFamily: "Poppins, sans-serif", fontWeight: 400 }}
                        >
                          {formatDate(account.verifiedAt)}
                        </p>
                      </div>

                      {/* Desktop Grid Layout */}
                      <div className="hidden md:grid grid-cols-[1fr_150px_220px_100px] items-center gap-4">
                        {/* NEAR Account - left aligned */}
                        <a
                          href={NEAR_CONFIG.explorerAccountUrl(account.nearAccountId)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[16px] leading-[1.3] text-foreground tracking-[0.32px] hover:underline inline-flex items-center gap-[8px]"
                          style={{ fontFamily: "Inter, sans-serif", fontWeight: 600 }}
                        >
                          {account.nearAccountId}
                          <ExternalLink className="h-4 w-4 text-[#00ec97]" />
                        </a>

                        {/* Attestation Type with Nullifier Tooltip - center aligned */}
                        <div className="flex justify-center">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="bg-[#79d1ac] flex h-[32px] items-center px-[8px] rounded-full cursor-pointer">
                                <span
                                  className="text-[12px] leading-[1.4] text-[#002716] tracking-[0.24px]"
                                  style={{ fontFamily: "Poppins, sans-serif", fontWeight: 400 }}
                                >
                                  {getAttestationType(account.attestationId)}
                                </span>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent
                              side="left"
                              className="bg-[#1c1c1c] text-[#fcfaf7] rounded-[8px] px-[16px] py-[8px] text-[14px] leading-[1.4]"
                              style={{ fontFamily: "'FK Grotesk Variable', sans-serif", fontWeight: 400 }}
                            >
                              Nullifier: {truncate(account.nullifier, 16)}
                            </TooltipContent>
                          </Tooltip>
                        </div>

                        {/* Verified At - center aligned */}
                        <p
                          className="text-[14px] leading-[1.4] text-foreground text-center tracking-[0.28px]"
                          style={{ fontFamily: "Poppins, sans-serif", fontWeight: 400 }}
                        >
                          {formatDate(account.verifiedAt)}
                        </p>

                        {/* Details Button - right aligned */}
                        <div className="flex justify-end">
                          <Button
                            variant="citizens-primary"
                            size="citizens-md"
                            onClick={() => {
                              const found = accounts.find((a) => a.account.nearAccountId === account.nearAccountId)
                              if (found) handleViewDetails(found)
                            }}
                          >
                            Details
                          </Button>
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* Pagination */}
          <div className="flex flex-col gap-3 items-center md:flex-row md:justify-between mt-6 md:mt-[24px] w-full max-w-[1276px] px-4 md:px-0">
            <p
              className="text-[12px] md:text-[14px] leading-[1.4] text-muted-foreground order-2 md:order-1"
              style={{ fontFamily: "Inter, sans-serif", fontWeight: 400 }}
            >
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
        </div>
      </div>

      {/* Details Dialog */}
      <VerificationDetailsDialog
        data={selectedAccount}
        open={!!selectedAccount}
        onOpenChange={(open) => !open && setSelectedAccount(null)}
      />
    </TooltipProvider>
  )
}
