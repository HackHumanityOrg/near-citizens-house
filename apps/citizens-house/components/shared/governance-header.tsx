"use client"

import Link from "next/link"
import { Button, ThemeToggle } from "@near-citizens/ui"
import { useNearWallet } from "@near-citizens/shared"
import { PlusCircle, Wallet, LogOut } from "lucide-react"

export function GovernanceHeader() {
  const { accountId, connect, disconnect } = useNearWallet()

  return (
    <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 py-4 max-w-7xl">
        <div className="flex items-center justify-between">
          {/* Logo/Title */}
          <Link href="/" className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">NEAR Citizens House</h1>
          </Link>

          {/* Actions */}
          <div className="flex items-center gap-3">
            {accountId ? (
              <>
                <Link href="/proposals/create">
                  <Button size="default">
                    <PlusCircle className="mr-2 h-4 w-4" />
                    New Proposal
                  </Button>
                </Link>
                <Button variant="outline" onClick={disconnect}>
                  <LogOut className="mr-2 h-4 w-4" />
                  {accountId.length > 20 ? `${accountId.slice(0, 10)}...${accountId.slice(-6)}` : accountId}
                </Button>
              </>
            ) : (
              <Button onClick={connect}>
                <Wallet className="mr-2 h-4 w-4" />
                Connect Wallet
              </Button>
            )}
            <ThemeToggle />
          </div>
        </div>
      </div>
    </div>
  )
}
