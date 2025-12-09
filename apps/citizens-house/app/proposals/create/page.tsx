"use client"

import Link from "next/link"
import { CreateProposalForm } from "@/components/proposals/create-proposal-form"
import { Button } from "@near-citizens/ui"
import { useNearWallet } from "@near-citizens/shared"
import { ArrowLeft, Loader2, Wallet } from "lucide-react"
import { GovernanceHeader } from "@/components/shared/governance-header"
import { useVerification } from "@/hooks/verification"
import { useGovernanceParams } from "@/hooks/governance-params"

function CreateProposalContent() {
  const { isConnected, connect, isLoading: walletLoading } = useNearWallet()
  const { isVerified, loading: verificationLoading } = useVerification()
  const { totalCitizens, governanceParams, loading: paramsLoading } = useGovernanceParams()

  const loading = walletLoading || verificationLoading || paramsLoading

  if (loading) {
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
        isVerified={isVerified}
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
