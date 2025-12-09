"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { CreateProposalForm } from "@/components/proposals/create-proposal-form"
import { Button } from "@near-citizens/ui"
import { useNearWallet } from "@near-citizens/shared"
import { ArrowLeft, Loader2, Wallet } from "lucide-react"
import { checkVerificationStatus, getTotalCitizens, getGovernanceParameters } from "@/lib/actions/governance"
import { GovernanceHeader } from "@/components/shared/governance-header"

interface GovernanceParams {
  quorumPercentageMin: number
  quorumPercentageMax: number
  quorumPercentageDefault: number
}

function CreateProposalContent() {
  const { accountId, isConnected, connect, isLoading: walletLoading } = useNearWallet()
  const [isVerified, setIsVerified] = useState<boolean | null>(null)
  const [totalCitizens, setTotalCitizens] = useState<number>(0)
  const [governanceParams, setGovernanceParams] = useState<GovernanceParams | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadData = async () => {
      // Fetch total citizens and governance parameters for the quorum display
      try {
        const [total, params] = await Promise.all([getTotalCitizens(), getGovernanceParameters()])
        setTotalCitizens(total)
        setGovernanceParams(params)
      } catch (error) {
        console.error("Error fetching data:", error)
      }

      if (!accountId) {
        setIsVerified(false)
        setLoading(false)
        return
      }

      try {
        const verified = await checkVerificationStatus(accountId)
        setIsVerified(verified)
      } catch (error) {
        console.error("Error checking verification:", error)
        setIsVerified(false)
      } finally {
        setLoading(false)
      }
    }

    if (!walletLoading) {
      loadData()
    }
  }, [accountId, walletLoading])

  if (walletLoading || loading) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-3xl">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  if (!isConnected) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-3xl">
        {/* Header */}
        <div className="mb-8">
          <Link href="/proposals">
            <Button variant="ghost" size="sm" className="mb-4">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Proposals
            </Button>
          </Link>
          <h1 className="text-4xl font-bold">Create Proposal</h1>
        </div>

        {/* Connect Wallet Prompt */}
        <div className="text-center py-12 border rounded-lg bg-muted/50">
          <Wallet className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-xl font-semibold mb-4">Connect Wallet</h2>
          <p className="text-muted-foreground mb-6">Please connect your wallet to create a proposal</p>
          <Button onClick={connect}>
            <Wallet className="mr-2 h-4 w-4" />
            Connect Wallet
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-3xl">
      {/* Header */}
      <div className="mb-8">
        <Link href="/proposals">
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Proposals
          </Button>
        </Link>
        <h1 className="text-4xl font-bold">Create Proposal</h1>
      </div>

      {/* Form */}
      <CreateProposalForm
        isVerified={isVerified || false}
        totalCitizens={totalCitizens}
        quorumPercentageMin={governanceParams?.quorumPercentageMin ?? 1}
        quorumPercentageMax={governanceParams?.quorumPercentageMax ?? 100}
        quorumPercentageDefault={governanceParams?.quorumPercentageDefault ?? 10}
      />
    </div>
  )
}

export default function CreateProposalPage() {
  return (
    <div className="min-h-screen bg-linear-to-b from-background to-background/80">
      <GovernanceHeader />
      <CreateProposalContent />
    </div>
  )
}
