"use client"

import { cn } from "@/components/ui/utils"

const CONSENT_STORAGE_KEY = "posthog_consent"
const CONSENT_RESET_EVENT = "posthog-consent-reset"

interface CookieSettingsLinkProps {
  className?: string
}

export function CookieSettingsLink({ className }: CookieSettingsLinkProps) {
  const handleClick = () => {
    if (typeof window === "undefined") return

    window.localStorage.removeItem(CONSENT_STORAGE_KEY)
    window.dispatchEvent(new Event(CONSENT_RESET_EVENT))
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        "text-[16px] leading-[28px] text-black dark:text-white hover:opacity-70 transition-opacity font-fk-grotesk",
        className,
      )}
    >
      Cookie settings
    </button>
  )
}
