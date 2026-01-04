"use client"

import Image from "next/image"
import Link from "next/link"
import { useNearWallet } from "@near-citizens/shared"
import { Button, cn } from "@near-citizens/ui"

type VerificationCtaButtonProps = {
  className?: string
  size?: "hero" | "steps"
  labelDisconnected?: string
  labelConnected?: string
}

export function VerificationCtaButton({
  className,
  size = "hero",
  labelDisconnected = "Connect NEAR Wallet",
  labelConnected = "Get Verified",
}: VerificationCtaButtonProps) {
  const { isConnected, connect, isLoading } = useNearWallet()
  const label = isConnected ? labelConnected : labelDisconnected

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
      onClick={connect}
      disabled={isLoading}
      aria-busy={isLoading}
      variant="citizens-primary"
      size={null}
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
