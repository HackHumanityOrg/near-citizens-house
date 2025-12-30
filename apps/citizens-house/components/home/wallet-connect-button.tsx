"use client"

import { useNearWallet } from "@near-citizens/shared"
import { Button } from "@near-citizens/ui"
import { Wallet, LogOut } from "lucide-react"

export function WalletConnectButton() {
  const { accountId, isConnected, connect, disconnect, isLoading } = useNearWallet()

  if (isLoading) {
    return (
      <Button disabled variant="outline" className="gap-2 bg-transparent">
        <Wallet className="h-4 w-4" />
        Loading...
      </Button>
    )
  }

  if (isConnected && accountId) {
    return (
      <div className="flex items-center gap-2">
        <div className="text-sm text-muted-foreground font-mono">{accountId}</div>
        <Button onClick={disconnect} variant="outline" size="sm" className="gap-2 bg-transparent">
          <LogOut className="h-4 w-4" />
          Disconnect
        </Button>
      </div>
    )
  }

  return (
    <Button onClick={connect} className="gap-2">
      <Wallet className="h-4 w-4" />
      Connect NEAR Wallet
    </Button>
  )
}
