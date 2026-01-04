"use client"

import Image from "next/image"
import Link from "next/link"
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
import { useVerification } from "@/hooks/verification"
import { Loader2, ChevronDown, Wallet } from "lucide-react"
import { FEATURE_FLAGS } from "@/lib/feature-flags"

export function Header() {
  const { accountId, isConnected, connect, disconnect, isLoading } = useNearWallet()
  const { isAdmin, loading: adminLoading } = useIsAdmin()
  const { isVerified, loading: verificationLoading } = useVerification()

  // Show "Get Verified to Vote" when not connected OR connected but not verified
  const showGetVerified = !isConnected || (!verificationLoading && !isVerified)

  // Primary nav item for mobile
  const primaryNavItem = showGetVerified
    ? { label: "Get Verified to Vote", href: "/verification/start", underline: true }
    : { label: "Citizens", href: "/citizens", underline: false }

  // Dropdown items (excludes the primary item)
  const dropdownItems = [
    ...(FEATURE_FLAGS.GOVERNANCE_ENABLED && showGetVerified
      ? [{ label: "Proposals", href: "/governance/proposals" }]
      : []),
    ...(showGetVerified ? [{ label: "Citizens", href: "/citizens" }] : []),
    ...(FEATURE_FLAGS.GOVERNANCE_ENABLED && !showGetVerified
      ? [{ label: "Get Verified to Vote", href: "/verification/start" }]
      : []),
    ...(FEATURE_FLAGS.GOVERNANCE_ENABLED && !adminLoading && isAdmin
      ? [{ label: "Admin", href: "/governance/admin" }]
      : []),
  ]

  return (
    <header className="relative z-50 bg-transparent">
      {/* Mobile Header */}
      <div className="flex md:hidden items-center justify-between px-6 py-6">
        {/* Mobile Logo - Left */}
        <Link href="/" className="flex items-center shrink-0">
          <Image src="/logo-mobile.svg" alt="NEAR Citizens House" width={61} height={26} className="dark:invert" />
        </Link>

        {/* Mobile Navigation with Dropdown - Center */}
        <div className="flex items-center gap-2">
          <Link
            href={primaryNavItem.href}
            className={`text-base hover:opacity-70 transition-opacity ${primaryNavItem.underline ? "underline" : ""}`}
          >
            {primaryNavItem.label}
          </Link>
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <button className="p-1 hover:opacity-70 transition-opacity" aria-label="Navigation menu">
                <ChevronDown className="h-2 w-2" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="center"
              className="bg-white dark:bg-black border-[rgba(0,0,0,0.1)] dark:border-white/20"
            >
              {dropdownItems.map((item) => (
                <DropdownMenuItem key={item.href} asChild>
                  <Link
                    href={item.href}
                    className="cursor-pointer font-inter text-[14px] text-[#090909] dark:text-neutral-200"
                  >
                    {item.label}
                  </Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Mobile Wallet Button - Right */}
        {isLoading ? (
          <button disabled className="p-1 opacity-50" aria-label="Connecting wallet">
            <Loader2 className="h-5 w-5 animate-spin" />
          </button>
        ) : isConnected ? (
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <button aria-label="Account menu">
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
          <button onClick={connect} className="p-1" aria-label="Connect wallet">
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

        {/* Desktop Navigation - Order: Get Verified (underlined), Proposals, Citizens */}
        <nav className="flex items-center gap-20">
          {showGetVerified && (
            <Link href="/verification/start" className="text-base underline hover:opacity-70 transition-opacity">
              Get Verified to Vote
            </Link>
          )}
          {FEATURE_FLAGS.GOVERNANCE_ENABLED && (
            <Link href="/governance/proposals" className="text-base hover:opacity-70 transition-opacity">
              Proposals
            </Link>
          )}
          <Link href="/citizens" className="text-base hover:opacity-70 transition-opacity">
            Citizens
          </Link>
          {FEATURE_FLAGS.GOVERNANCE_ENABLED && !adminLoading && isAdmin && (
            <Link href="/governance/admin" className="text-base hover:opacity-70 transition-opacity">
              Admin
            </Link>
          )}
        </nav>

        {/* Desktop Right Side: Wallet + Theme Toggle */}
        <div className="flex items-center gap-10 ml-auto">
          {isLoading ? (
            <Button variant="citizens-primary" size="citizens-xl" disabled>
              <Loader2 className="h-4 w-4 animate-spin" />
              Connecting...
            </Button>
          ) : isConnected ? (
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2">
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
