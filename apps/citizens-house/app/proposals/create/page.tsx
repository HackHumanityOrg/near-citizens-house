"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { CreateProposalForm } from "@/components/proposals/create-proposal-form"
import { Button } from "@near-citizens/ui"
import { ArrowLeft, Loader2 } from "lucide-react"

export default function CreateProposalPage() {
  const [isVerified, setIsVerified] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check if user is verified
    // TODO: Get actual wallet address from wallet connection
    const checkVerification = async () => {
      try {
        // For now, we'll fetch from the API
        // In production, this should use the wallet connection
        const response = await fetch("/api/verified-accounts/check")
        const data = await response.json()
        setIsVerified(data.isVerified || false)
      } catch (error) {
        console.error("Error checking verification:", error)
        setIsVerified(false)
      } finally {
        setLoading(false)
      }
    }

    checkVerification()
  }, [])

  if (loading) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-3xl">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
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
      <CreateProposalForm isVerified={isVerified || false} />
    </div>
  )
}
