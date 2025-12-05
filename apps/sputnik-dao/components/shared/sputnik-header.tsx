"use client"

import Link from "next/link"
import { Button, ThemeToggle } from "@near-citizens/ui"
import { useNearWallet } from "@near-citizens/shared"
import { useIsAdmin } from "@/hooks/admin"
import { LogIn, LogOut, Settings, Loader2 } from "lucide-react"

export function SputnikHeader() {
  const { accountId, isConnected, connect, disconnect, isLoading } = useNearWallet()
  const { isAdmin, loading: adminLoading } = useIsAdmin()

  return (
    <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 max-w-7xl">
        <div className="flex h-16 items-center justify-between">
          {/* Logo & Navigation */}
          <div className="flex items-center gap-8">
            <Link href="/" className="font-bold text-xl">
              SputnikDAO
            </Link>
            <nav className="hidden md:flex items-center gap-6">
              <Link href="/proposals" className="text-sm font-medium hover:text-primary transition-colors">
                Proposals
              </Link>
              {!adminLoading && isAdmin && (
                <Link href="/admin" className="text-sm font-medium hover:text-primary transition-colors">
                  Admin
                </Link>
              )}
            </nav>
          </div>

          {/* Right Side: Theme Toggle & Wallet */}
          <div className="flex items-center gap-4">
            <ThemeToggle />

            {isLoading ? (
              <Button variant="outline" disabled>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Connecting...
              </Button>
            ) : isConnected ? (
              <div className="flex items-center gap-2">
                {/* Admin indicator */}
                {!adminLoading && isAdmin && (
                  <Link href="/admin">
                    <Button variant="ghost" size="icon" title="Admin Settings">
                      <Settings className="h-4 w-4" />
                    </Button>
                  </Link>
                )}

                {/* Account ID display */}
                <span className="text-sm text-muted-foreground hidden sm:inline">
                  {accountId?.split(".")[0]}...
                </span>

                {/* Disconnect button */}
                <Button variant="outline" size="sm" onClick={disconnect}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Disconnect
                </Button>
              </div>
            ) : (
              <Button onClick={connect}>
                <LogIn className="mr-2 h-4 w-4" />
                Connect Wallet
              </Button>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
