"use client"

import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useRef } from "react"
import { useNearWallet } from "@near-citizens/shared"
import { Button, cn } from "@near-citizens/ui"

type VerificationCtaButtonProps = {
  className?: string
  size?: "hero" | "steps"
  labelDisconnected?: string
  labelConnected?: string
  testId?: string
}

export function VerificationCtaButton({
  className,
  size = "hero",
  labelDisconnected = "Connect NEAR Wallet",
  labelConnected = "Get Verified",
  testId = "connect-wallet-button",
}: VerificationCtaButtonProps) {
  const router = useRouter()
  const { isConnected, connect, isLoading } = useNearWallet()
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
    didRequestConnect.current = true
    try {
      await connect()
    } catch (error) {
      didRequestConnect.current = false
      throw error
    }
  }

  // Exact Figma specs: pl-8px pr-24px py-8px, gap-12px, icon: 32x32 with 8px padding
  const sizeClassName = size === "steps" ? "h-[56px]" : ""

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
        size={null}
        data-testid={`${testId}-connected`}
        className={cn(
          "h-auto gap-[12px] overflow-hidden rounded-[4px] pl-[8px] pr-[24px] py-[8px] text-[16px] font-medium leading-[24px]",
          "font-fk-grotesk",
          sizeClassName,
          className,
        )}
      >
        <Link href="/verification/start">{content}</Link>
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
      size={null}
      data-testid={testId}
      className={cn(
        "h-auto gap-[12px] overflow-hidden rounded-[4px] pl-[8px] pr-[24px] py-[8px] text-[16px] font-medium leading-[24px]",
        "font-fk-grotesk",
        sizeClassName,
        className,
      )}
    >
      {isLoading ? loadingContent : content}
    </Button>
  )
}
