"use client"

import Image from "next/image"
import Link from "next/link"
import { Button, ThemeToggle } from "@near-citizens/ui"
import { useNearWallet, APP_URLS } from "@near-citizens/shared"
import { useIsAdmin } from "@/hooks/admin"
import { useVerification } from "@/hooks/verification"
import { LogIn, LogOut, Loader2, ShieldCheck } from "lucide-react"

export function SputnikHeader() {
  const { isConnected, connect, disconnect, isLoading } = useNearWallet()
  const { isAdmin, loading: adminLoading } = useIsAdmin()
  const { isVerified, loading: verificationLoading } = useVerification()

  return (
    <header className="border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
      <div className="container mx-auto px-4 max-w-7xl">
        <div className="flex h-16 items-center justify-between">
          {/* Logo & Navigation */}
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center">
              <Image src="/logo.svg" alt="NEAR Citizens House" width={280} height={33} className="dark:invert" />
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

          {/* Right Side: Verification > Wallet > Theme Toggle */}
          <div className="flex items-center gap-4">
            {/* Get Verified button - shown when connected but not verified */}
            {isConnected && !verificationLoading && !isVerified && (
              <a href={APP_URLS.verification} target="_blank" rel="noopener noreferrer">
                <Button
                  variant="default"
                  size="sm"
                  className="bg-black hover:bg-black/90 text-white border-0 shadow-md"
                >
                  <ShieldCheck className="mr-2 h-4 w-4" />
                  Get Verified to Vote
                </Button>
              </a>
            )}

            {isLoading ? (
              <Button variant="outline" disabled>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Connecting...
              </Button>
            ) : isConnected ? (
              <Button variant="outline" size="sm" onClick={disconnect}>
                <LogOut className="mr-2 h-4 w-4" />
                Disconnect
              </Button>
            ) : (
              <Button onClick={connect}>
                <LogIn className="mr-2 h-4 w-4" />
                Connect Wallet
              </Button>
            )}

            <ThemeToggle />
          </div>
        </div>
      </div>
    </header>
  )
}
