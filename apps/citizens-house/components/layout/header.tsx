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
} from "@near-citizens/ui"
import { useNearWallet } from "@near-citizens/shared"
import { useIsAdmin } from "@/hooks/admin"
import { useVerification } from "@/hooks/verification"
import { Loader2, ChevronDown, Wallet } from "lucide-react"

export function Header() {
  const { isConnected, connect, disconnect, isLoading } = useNearWallet()
  const { isAdmin, loading: adminLoading } = useIsAdmin()
  const { isVerified, loading: verificationLoading } = useVerification()

  // Show "Get Verified to Vote" as primary when not connected OR connected but not verified
  const showGetVerifiedAsPrimary = !isConnected || (!verificationLoading && !isVerified)

  // Primary nav item for mobile
  const primaryNavItem = showGetVerifiedAsPrimary
    ? { label: "Get Verified to Vote", href: "/verification", underline: true }
    : { label: "Proposals", href: "/governance/proposals", underline: false }

  // Dropdown items (excludes the primary item)
  const dropdownItems = [
    ...(showGetVerifiedAsPrimary
      ? [{ label: "Proposals", href: "/governance/proposals" }]
      : [{ label: "Get Verified to Vote", href: "/verification" }]),
    { label: "Citizens", href: "/citizens" },
    ...(!adminLoading && isAdmin ? [{ label: "Admin", href: "/governance/admin" }] : []),
  ]

  return (
    <header className="bg-background">
      {/* Mobile Header */}
      <div className="flex md:hidden items-center justify-center gap-8 px-6 py-6">
        {/* Mobile Logo */}
        <Link href="/" className="flex items-center shrink-0">
          <Image src="/logo-mobile.svg" alt="NEAR Citizens House" width={61} height={26} className="dark:invert" />
        </Link>

        {/* Mobile Navigation with Dropdown */}
        <div className="flex items-center gap-2">
          <Link
            href={primaryNavItem.href}
            className={`text-base hover:opacity-70 transition-opacity ${primaryNavItem.underline ? "underline" : ""}`}
          >
            {primaryNavItem.label}
          </Link>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="p-1 hover:opacity-70 transition-opacity" aria-label="Navigation menu">
                <ChevronDown className="h-2 w-2" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center">
              {dropdownItems.map((item) => (
                <DropdownMenuItem key={item.href} asChild>
                  <Link href={item.href} className="cursor-pointer">
                    {item.label}
                  </Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Mobile Wallet Button (icon only, no background) */}
        {isLoading ? (
          <button disabled className="p-1 opacity-50" aria-label="Connecting wallet">
            <Loader2 className="h-5 w-5 animate-spin" />
          </button>
        ) : (
          <button
            onClick={isConnected ? disconnect : connect}
            className="p-1 hover:opacity-70 transition-opacity"
            aria-label={isConnected ? "Disconnect wallet" : "Connect wallet"}
          >
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
          {showGetVerifiedAsPrimary && (
            <Link href="/verification" className="text-base underline hover:opacity-70 transition-opacity">
              Get Verified to Vote
            </Link>
          )}
          <Link href="/governance/proposals" className="text-base hover:opacity-70 transition-opacity">
            Proposals
          </Link>
          <Link href="/citizens" className="text-base hover:opacity-70 transition-opacity">
            Citizens
          </Link>
          {!adminLoading && isAdmin && (
            <Link href="/governance/admin" className="text-base hover:opacity-70 transition-opacity">
              Admin
            </Link>
          )}
        </nav>

        {/* Desktop Right Side: Wallet + Theme Toggle */}
        <div className="flex items-center gap-10 ml-auto">
          <div className="flex items-center gap-4">
            {isLoading ? (
              <Button
                className="bg-[#040404] text-[#d8d8d8] rounded px-6 py-3.5 opacity-70 cursor-not-allowed"
                disabled
              >
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Connecting...
              </Button>
            ) : isConnected ? (
              <Button
                className="bg-[#040404] hover:bg-[#040404]/90 text-[#d8d8d8] rounded px-6 py-3.5"
                onClick={disconnect}
              >
                Disconnect
              </Button>
            ) : (
              <Button
                className="bg-[#040404] hover:bg-[#040404]/90 text-[#d8d8d8] rounded px-6 py-3.5"
                onClick={connect}
              >
                Connect Wallet
              </Button>
            )}
          </div>

          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}
