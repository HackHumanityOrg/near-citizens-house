"use client"

import { useEffect, useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Loader2, ExternalLink, ChevronLeft, ChevronRight, List, CheckCircle, XCircle } from "lucide-react"
import Link from "next/link"
import type { VerifiedAccount } from "@/lib/database"
import { VerificationModal } from "@/components/verification-modal"
import { ThemeToggle } from "@/components/theme-toggle"

interface VerificationsResponse {
  accounts: VerifiedAccount[]
  total: number
  page: number
  pageSize: number
}

export default function VerificationsPage() {
  const [data, setData] = useState<VerificationsResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(0)
  const [verifyResults, setVerifyResults] = useState<Record<string, "pending" | "success" | "error">>({})
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null)
  const pageSize = 10 // Match API default

  const verifyAccount = useCallback(async (nearAccountId: string) => {
    setVerifyResults((prev) => ({ ...prev, [nearAccountId]: "pending" }))
    try {
      const response = await fetch("/api/verify-stored", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nearAccountId }),
      })
      const result = await response.json()
      setVerifyResults((prev) => ({
        ...prev,
        [nearAccountId]: result.verified ? "success" : "error",
      }))
    } catch {
      setVerifyResults((prev) => ({ ...prev, [nearAccountId]: "error" }))
    }
  }, [])

  const fetchVerifications = async (page: number) => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/verifications?page=${page}&pageSize=${pageSize}`)
      if (!response.ok) {
        throw new Error("Failed to fetch verifications")
      }
      const result = await response.json()
      setData(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load verifications")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchVerifications(currentPage)
  }, [currentPage])

  // Auto-verify all accounts when data loads
  useEffect(() => {
    if (data?.accounts) {
      data.accounts.forEach((account) => {
        if (!verifyResults[account.nearAccountId]) {
          verifyAccount(account.nearAccountId)
        }
      })
    }
  }, [data, verifyAccount, verifyResults])

  const totalPages = data ? Math.ceil(data.total / pageSize) : 0
  const hasNextPage = currentPage < totalPages - 1
  const hasPrevPage = currentPage > 0

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const truncate = (str: string, maxLength: number = 16) => {
    if (str.length <= maxLength) return str
    return `${str.slice(0, maxLength / 2)}...${str.slice(-maxLength / 2)}`
  }

  const getAttestationType = (attestationId: string) => {
    const types: Record<string, string> = {
      "1": "Passport",
      "2": "Biometric ID",
      "3": "Aadhaar",
    }
    return types[attestationId] || `Type ${attestationId}`
  }

  const handleVerify = (nearAccountId: string) => {
    setSelectedAccount(nearAccountId)
    setModalOpen(true)
  }

  const handleVerificationComplete = (result: { verified: boolean }) => {
    if (selectedAccount) {
      setVerifyResults((prev) => ({
        ...prev,
        [selectedAccount]: result.verified ? "success" : "error",
      }))
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-background/80 overflow-x-hidden">
      <div className="container mx-auto px-4 py-12">
        <div className="fixed top-4 right-4 z-50">
          <ThemeToggle />
        </div>

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
                      {data ? `Showing ${data.accounts.length} of ${data.total} verified accounts` : "Loading..."}
                    </span>
                    <a
                      href={`https://${process.env.NEXT_PUBLIC_NEAR_NETWORK === "mainnet" ? "" : "testnet."}nearblocks.io/address/${process.env.NEXT_PUBLIC_NEAR_CONTRACT_ID || "v1.widefile4023.testnet"}`}
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
                  {isLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                  ) : error ? (
                    <div className="text-center py-12 text-destructive">{error}</div>
                  ) : !data || data.accounts.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      No verified accounts yet. Be the first to verify!
                    </div>
                  ) : (
                    <>
                      <div className="rounded-md border bg-card">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>NEAR Account</TableHead>
                              <TableHead>Attestation Type</TableHead>
                              <TableHead>User ID</TableHead>
                              <TableHead>Nullifier</TableHead>
                              <TableHead>Verified At</TableHead>
                              <TableHead>Verify</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {data.accounts.map((account) => (
                              <TableRow key={account.nearAccountId}>
                                <TableCell className="font-mono text-sm">
                                  <a
                                    href={`https://explorer.${process.env.NEXT_PUBLIC_NEAR_NETWORK || "testnet"}.near.org/accounts/${account.nearAccountId}`}
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
                                    onClick={() => handleVerify(account.nearAccountId)}
                                    title="View verification details"
                                  >
                                    {verifyResults[account.nearAccountId] === "pending" ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : verifyResults[account.nearAccountId] === "success" ? (
                                      <CheckCircle className="h-4 w-4 text-green-500" />
                                    ) : verifyResults[account.nearAccountId] === "error" ? (
                                      <XCircle className="h-4 w-4 text-red-500" />
                                    ) : (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    )}
                                    <span className="ml-1">Details</span>
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>

                      {totalPages > 1 && (
                        <div className="flex items-center justify-between mt-4">
                          <div className="text-sm text-muted-foreground">
                            Page {currentPage + 1} of {totalPages}
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setCurrentPage((p) => p - 1)}
                              disabled={!hasPrevPage}
                            >
                              <ChevronLeft className="h-4 w-4" />
                              Previous
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setCurrentPage((p) => p + 1)}
                              disabled={!hasNextPage}
                            >
                              Next
                              <ChevronRight className="h-4 w-4" />
                            </Button>
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

      {/* Verification Modal */}
      {selectedAccount && (
        <VerificationModal
          open={modalOpen}
          onOpenChange={setModalOpen}
          nearAccountId={selectedAccount}
          onVerificationComplete={handleVerificationComplete}
        />
      )}
    </div>
  )
}
