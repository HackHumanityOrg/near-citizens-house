"use client"

import { useState } from "react"
import Link from "next/link"
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@near-citizens/ui"
import { NEAR_CONFIG } from "@near-citizens/shared"
import { CheckCircle, XCircle, ChevronLeft, ChevronRight, ExternalLink, List } from "lucide-react"
import { VerificationDetailsDialog } from "./verification-details-dialog"
import type { VerifiedAccountWithStatus } from "@/app/verified-accounts/actions"

interface Props {
  accounts: VerifiedAccountWithStatus[]
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

export function VerifiedAccountsTable({ accounts, total, page, pageSize: _pageSize, totalPages }: Props) {
  const [selectedAccount, setSelectedAccount] = useState<VerifiedAccountWithStatus | null>(null)

  return (
    <>
      <div className="container mx-auto px-4 pt-6 pb-12">
        <div className="max-w-7xl mx-auto space-y-12">
          <Card className="border-0 bg-transparent shadow-none">
            <CardContent className="space-y-3 py-4">
              <div className="flex items-center">
                <Link href="/">
                  <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground hover:text-foreground">
                    ← Back to Verification
                  </Button>
                </Link>
              </div>
              <div className="text-center space-y-2">
                <div className="flex items-center justify-center gap-2">
                  <List className="h-8 w-8 text-primary" />
                  <h1 className="text-3xl font-bold">Verified Accounts</h1>
                </div>
                <p className="text-muted-foreground">All NEAR accounts verified through Self.xyz passport proofs</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 bg-transparent shadow-none">
            <CardContent className="py-8">
              <Card>
                <CardHeader>
                  <CardTitle>Verification Records</CardTitle>
                  <CardDescription className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <span>
                      {accounts.length > 0
                        ? `Showing ${accounts.length} of ${total} verified accounts`
                        : "No verified accounts yet"}
                    </span>
                    <a
                      href={NEAR_CONFIG.explorerAccountUrl(NEAR_CONFIG.verificationContractId)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs hover:text-foreground transition-colors"
                    >
                      View contract on NearBlocks
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {accounts.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      No verified accounts yet. Be the first to verify!
                    </div>
                  ) : (
                    <>
                      <div className="rounded-md border bg-card">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="min-w-[180px]">NEAR Account</TableHead>
                              <TableHead className="min-w-[120px]">Attestation Type</TableHead>
                              <TableHead className="min-w-[140px]">User ID</TableHead>
                              <TableHead className="min-w-[120px]">Nullifier</TableHead>
                              <TableHead className="min-w-[180px]">Verified At</TableHead>
                              <TableHead className="min-w-[100px]">Verify</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {accounts.map(({ account, verification }) => {
                              const isValid = verification.zkValid && verification.signatureValid
                              return (
                                <TableRow key={account.nearAccountId}>
                                  <TableCell className="font-mono text-sm">
                                    <a
                                      href={NEAR_CONFIG.explorerAccountUrl(account.nearAccountId)}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="hover:text-primary inline-flex items-center gap-1"
                                    >
                                      {account.nearAccountId}
                                      <ExternalLink className="h-3 w-3" />
                                    </a>
                                  </TableCell>
                                  <TableCell className="font-medium">
                                    {getAttestationType(account.attestationId)}
                                  </TableCell>
                                  <TableCell className="font-mono text-xs text-muted-foreground" title={account.userId}>
                                    {truncate(account.userId, 20)}
                                  </TableCell>
                                  <TableCell
                                    className="font-mono text-xs text-muted-foreground"
                                    title={account.nullifier}
                                  >
                                    {truncate(account.nullifier, 16)}
                                  </TableCell>
                                  <TableCell className="text-sm text-muted-foreground">
                                    {formatDate(account.verifiedAt)}
                                  </TableCell>
                                  <TableCell>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() =>
                                        setSelectedAccount(
                                          accounts.find((a) => a.account.nearAccountId === account.nearAccountId) ||
                                            null,
                                        )
                                      }
                                      title="View verification details"
                                    >
                                      {isValid ? (
                                        <CheckCircle className="h-4 w-4 text-vote-for" />
                                      ) : (
                                        <XCircle className="h-4 w-4 text-vote-against" />
                                      )}
                                      <span className="ml-1">Details</span>
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              )
                            })}
                          </TableBody>
                        </Table>
                      </div>

                      {/* Pagination with <Link> for full SSR */}
                      {totalPages > 1 && (
                        <div className="flex items-center justify-between mt-4">
                          <div className="text-sm text-muted-foreground">
                            Page {page + 1} of {totalPages}
                          </div>
                          <div className="flex gap-2">
                            {page > 0 ? (
                              <Button variant="outline" size="sm" asChild>
                                <Link href={`/verifications?page=${page - 1}`}>
                                  <ChevronLeft className="h-4 w-4" />
                                  Previous
                                </Link>
                              </Button>
                            ) : (
                              <Button variant="outline" size="sm" disabled>
                                <ChevronLeft className="h-4 w-4" />
                                Previous
                              </Button>
                            )}
                            {page < totalPages - 1 ? (
                              <Button variant="outline" size="sm" asChild>
                                <Link href={`/verifications?page=${page + 1}`}>
                                  Next
                                  <ChevronRight className="h-4 w-4" />
                                </Link>
                              </Button>
                            ) : (
                              <Button variant="outline" size="sm" disabled>
                                Next
                                <ChevronRight className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Details Dialog */}
      <VerificationDetailsDialog
        data={selectedAccount}
        open={!!selectedAccount}
        onOpenChange={(open) => !open && setSelectedAccount(null)}
      />
    </>
  )
}
