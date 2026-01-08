"use client"

import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Button,
  ThemeToggle,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  Identicon,
} from "@near-citizens/ui"
import { useNearWallet } from "@near-citizens/shared"
import { useIsAdmin } from "@/hooks/admin"
import { Loader2, ChevronDown, Wallet } from "lucide-react"
import { FEATURE_FLAGS } from "@/lib/feature-flags"

export function Header() {
  const pathname = usePathname()
  const isLandingOrVerification = pathname === "/" || pathname === "/verification"
  const { accountId, isConnected, connect, disconnect, isLoading } = useNearWallet()
  const { isAdmin, loading: adminLoading } = useIsAdmin()

  return (
    <header className="relative z-50 bg-transparent">
      {/* Mobile Header */}
      <div className="flex md:hidden items-center justify-between px-6 py-6">
        {/* Mobile Logo - Left */}
        <Link href="/" className="flex items-center shrink-0">
          <Image src="/logo-mobile.svg" alt="NEAR Citizens House" width={80} height={34} className="dark:invert" />
        </Link>

        {/* Mobile Navigation - Center */}
        <nav className="flex items-center gap-4">
          {/* Governance routes - depend on feature flag */}
          {FEATURE_FLAGS.GOVERNANCE_ENABLED && (
            <>
              <Link href="/governance/proposals" className="text-base hover:opacity-70 transition-opacity">
                Proposals
              </Link>
              {!adminLoading && isAdmin && (
                <Link href="/governance/admin" className="text-base hover:opacity-70 transition-opacity">
                  Admin
                </Link>
              )}
            </>
          )}
          {/* Future non-governance routes would go here without flags */}
        </nav>

        {/* Mobile Wallet Button - Right */}
        {/* On landing/verification: only show profile when connected. On other pages: show loading/profile/connect */}
        {isLandingOrVerification && !isConnected ? null : isLoading ? (
          <button disabled className="p-1 opacity-50 cursor-wait" aria-label="Connecting wallet">
            <Loader2 className="h-5 w-5 animate-spin" />
          </button>
        ) : isConnected ? (
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <button aria-label="Account menu" className="cursor-pointer">
                <Identicon value={accountId || ""} size={32} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="bg-white dark:bg-black border-[rgba(0,0,0,0.1)] dark:border-white/20"
            >
              <DropdownMenuLabel className="max-w-[200px] truncate font-inter text-[14px] text-[#757575] dark:text-[#a3a3a3]">
                {accountId}
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-[rgba(0,0,0,0.1)] dark:bg-white/20" />
              <DropdownMenuItem
                onClick={disconnect}
                className="cursor-pointer font-inter text-[14px] text-[#090909] dark:text-neutral-200"
              >
                Disconnect
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <button onClick={connect} className="p-1 cursor-pointer" aria-label="Connect wallet">
            <Wallet className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Desktop Header */}
      <div className="hidden md:flex items-center gap-20 px-10 py-6">
        {/* Desktop Logo */}
        <Link href="/" className="flex items-center shrink-0">
          <Image src="/logo-header.svg" alt="NEAR Citizens House" width={405} height={48} className="dark:invert" />
        </Link>

        {/* Desktop Navigation */}
        <nav className="flex items-center gap-20">
          {/* Governance routes - depend on feature flag */}
          {FEATURE_FLAGS.GOVERNANCE_ENABLED && (
            <>
              <Link href="/governance/proposals" className="text-base hover:opacity-70 transition-opacity">
                Proposals
              </Link>
              {!adminLoading && isAdmin && (
                <Link href="/governance/admin" className="text-base hover:opacity-70 transition-opacity">
                  Admin
                </Link>
              )}
            </>
          )}
          {/* Future non-governance routes would go here without flags */}
        </nav>

        {/* Desktop Right Side: Wallet + Theme Toggle */}
        {/* On landing/verification: only show profile when connected. On other pages: show loading/profile/connect */}
        <div className="flex items-center gap-10 ml-auto">
          {isLandingOrVerification && !isConnected ? null : isLoading ? (
            <Button variant="citizens-primary" size="citizens-xl" disabled>
              <Loader2 className="h-4 w-4 animate-spin" />
              Connecting...
            </Button>
          ) : isConnected ? (
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 cursor-pointer">
                  <Identicon value={accountId || ""} size={48} />
                  <ChevronDown className="h-6 w-6" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="min-w-[200px] bg-white dark:bg-black border-[rgba(0,0,0,0.1)] dark:border-white/20"
              >
                <DropdownMenuLabel className="max-w-[200px] truncate font-inter text-[14px] text-[#757575] dark:text-[#a3a3a3]">
                  {accountId}
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-[rgba(0,0,0,0.1)] dark:bg-white/20" />
                <DropdownMenuItem
                  onClick={disconnect}
                  className="cursor-pointer font-inter text-[14px] text-[#090909] dark:text-neutral-200"
                >
                  Disconnect
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button variant="citizens-primary" size="citizens-xl" onClick={connect}>
              Connect Wallet
            </Button>
          )}

          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}
