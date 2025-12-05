"use client"

import { useEffect, useState } from "react"
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@near-citizens/ui"
import { type BridgeInfo, type TransformedPolicy, formatProposalBond } from "@near-citizens/shared"
import { getBridgeInfo } from "@/lib/actions/bridge"
import { getPolicy } from "@/lib/actions/sputnik-dao"
import { Loader2, ExternalLink, Wallet, Users, FileText, Settings } from "lucide-react"

export function BridgeInfoCard() {
  const [info, setInfo] = useState<BridgeInfo | null>(null)
  const [policy, setPolicy] = useState<TransformedPolicy | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchInfo() {
      try {
        const [bridgeInfo, daoPolicy] = await Promise.all([getBridgeInfo(), getPolicy()])
        setInfo(bridgeInfo)
        setPolicy(daoPolicy)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load bridge info")
      } finally {
        setLoading(false)
      }
    }

    fetchInfo()
  }, [])

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  if (error || !info) {
    return (
      <Card>
        <CardContent className="py-6">
          <p className="text-destructive">{error || "Failed to load bridge info"}</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Bridge Configuration
        </CardTitle>
        <CardDescription>Current settings for the SputnikDAO bridge contract</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Backend Wallet */}
        <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
          <Wallet className="h-5 w-5 text-muted-foreground mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">Backend Wallet</p>
            <p className="text-sm text-muted-foreground break-all">{info.backendWallet}</p>
          </div>
        </div>

        {/* SputnikDAO Contract */}
        <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
          <FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">SputnikDAO Contract</p>
            <p className="text-sm text-muted-foreground break-all">{info.sputnikDao}</p>
          </div>
        </div>

        {/* Verified Accounts Contract */}
        <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
          <Users className="h-5 w-5 text-muted-foreground mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">Verified Accounts Contract</p>
            <p className="text-sm text-muted-foreground break-all">{info.verifiedAccountsContract}</p>
          </div>
        </div>

        {/* Citizen Role */}
        <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
          <Users className="h-5 w-5 text-muted-foreground mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">Citizen Role</p>
            <p className="text-sm text-muted-foreground">{info.citizenRole}</p>
          </div>
        </div>

        {/* DAO Policy Info */}
        {policy && (
          <div className="pt-4 border-t">
            <h4 className="font-medium mb-3">DAO Policy</h4>
            <div className="grid gap-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Proposal Bond</span>
                <span>{formatProposalBond(policy.proposalBond)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Voting Period</span>
                <span>{Math.round(policy.proposalPeriodMs / (24 * 60 * 60 * 1000))} days</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Roles</span>
                <span>{policy.roles.length}</span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
