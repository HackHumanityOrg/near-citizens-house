"use client"

import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useRef } from "react"
import * as Sentry from "@sentry/nextjs"
import { useNearWallet } from "@/lib"
import { trackEvent, getPlatform } from "@/lib/analytics"
import { Button, cn } from "@near-citizens/ui"

type VerificationCtaButtonProps = {
  className?: string
  labelDisconnected?: string
  labelConnected?: string
  testId?: string
}

export function VerificationCtaButton({
  className,
  labelDisconnected = "Connect NEAR Wallet",
  labelConnected = "Get Verified",
  testId = "connect-wallet-button",
}: VerificationCtaButtonProps) {
  const router = useRouter()
  const { isConnected, accountId, connect, isLoading } = useNearWallet()
  const label = isConnected ? labelConnected : labelDisconnected

  // Track connection attempts initiated from this CTA
  const didRequestConnect = useRef(false)
  const hasNavigated = useRef(false)

  // Auto-navigate to verification start after wallet connection
  useEffect(() => {
    // Only navigate if:
    // 1. Wallet SDK has finished loading
    // 2. User is now connected
    // 3. Connection was initiated via this CTA
    // 4. We haven't already navigated
    if (!isLoading && isConnected && didRequestConnect.current && !hasNavigated.current) {
      hasNavigated.current = true
      router.push("/verification/start")
    }
  }, [isLoading, isConnected, router])

  useEffect(() => {
    if (!isLoading && !isConnected && didRequestConnect.current) {
      didRequestConnect.current = false
    }
  }, [isLoading, isConnected])

  const handleConnect = async () => {
    trackEvent({
      domain: "verification",
      action: "cta_click",
      platform: getPlatform(),
      isConnected: false,
    })

    didRequestConnect.current = true
    try {
      await connect()
    } catch (error) {
      didRequestConnect.current = false
      Sentry.logger.warn("verification_cta_wallet_connect_failed", {
        account_id: accountId ?? "unknown",
        error_message: error instanceof Error ? error.message : "Unknown error",
      })
      throw error
    }
  }

  const handleConnectedClick = () => {
    trackEvent({
      domain: "verification",
      action: "cta_click",
      platform: getPlatform(),
      isConnected: true,
      accountId: accountId || undefined,
    })
  }

  const content = (
    <>
      <div className="flex h-[32px] w-[32px] shrink-0 items-center justify-center rounded-[2px] bg-white dark:bg-black p-[8px]">
        <div className="relative h-full w-full dark:invert">
          <Image src="/near-logo-symbol.svg" alt="NEAR" fill className="object-contain" />
        </div>
      </div>
      <span className="shrink-0 text-nowrap">{label}</span>
    </>
  )

  const loadingContent = (
    <>
      <div className="flex h-[32px] w-[32px] shrink-0 items-center justify-center rounded-[2px] bg-white dark:bg-black p-[8px]">
        <div className="relative h-full w-full dark:invert">
          <Image src="/near-logo-symbol.svg" alt="NEAR" fill className="object-contain" />
        </div>
      </div>
      <span className="shrink-0 text-nowrap">Loading...</span>
    </>
  )

  if (isConnected) {
    return (
      <Button
        asChild
        variant="citizens-primary"
        size="citizens-3xl"
        data-testid={`${testId}-connected`}
        className={cn(
          "justify-start gap-[12px] overflow-hidden rounded-[4px] pl-[8px] pr-[24px] py-[8px] font-medium",
          "font-fk-grotesk",
          className,
        )}
      >
        <Link href="/verification/start" onClick={handleConnectedClick}>
          {content}
        </Link>
      </Button>
    )
  }

  return (
    <Button
      type="button"
      onClick={handleConnect}
      disabled={isLoading}
      aria-busy={isLoading}
      variant="citizens-primary"
      size="citizens-3xl"
      data-testid={testId}
      className={cn(
        "justify-start gap-[12px] overflow-hidden rounded-[4px] pl-[8px] pr-[24px] py-[8px] font-medium",
        "font-fk-grotesk",
        className,
      )}
    >
      {isLoading ? loadingContent : content}
    </Button>
  )
}
