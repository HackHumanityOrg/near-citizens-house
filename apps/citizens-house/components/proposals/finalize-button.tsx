"use client"

import { Button } from "@near-citizens/ui"
import { type SputnikProposalKind, useNearWallet } from "@near-citizens/shared"
import { CheckCircle, Loader2 } from "lucide-react"
import { useSputnikDao } from "@/hooks/sputnik-dao"

interface FinalizeButtonProps {
  proposalId: number
  proposalKind: SputnikProposalKind
  onFinalizeSuccess?: () => void
}

export function FinalizeButton({ proposalId, proposalKind, onFinalizeSuccess }: FinalizeButtonProps) {
  const { finalize, isLoading, error, clearError } = useSputnikDao()
  const { isConnected, connect } = useNearWallet()

  const handleFinalize = async () => {
    if (!isConnected) {
      await connect()
      return
    }

    clearError()

    try {
      await finalize(proposalId, proposalKind)
      onFinalizeSuccess?.()
    } catch {
      // Error is already set by the hook
    }
  }

  return (
    <div className="space-y-2">
      <Button onClick={handleFinalize} disabled={isLoading} variant="outline" className="w-full">
        {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
        Finalize Proposal
      </Button>
      <p className="text-xs text-muted-foreground">
        Finalizing will mark the proposal as expired and return the bond to the proposer.
      </p>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
