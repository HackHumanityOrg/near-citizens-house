"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePostHog } from "posthog-js/react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

const CONSENT_STORAGE_KEY = "posthog_consent"
const CONSENT_RESET_EVENT = "posthog-consent-reset"

export function ConsentBanner() {
  const posthog = usePostHog()
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const updateVisibility = () => {
      const storedConsent = window.localStorage.getItem(CONSENT_STORAGE_KEY)
      setIsVisible(!storedConsent)
    }

    updateVisibility()

    window.addEventListener(CONSENT_RESET_EVENT, updateVisibility)

    return () => {
      window.removeEventListener(CONSENT_RESET_EVENT, updateVisibility)
    }
  }, [])

  if (!isVisible) return null

  const handleAccept = () => {
    window.localStorage.setItem(CONSENT_STORAGE_KEY, "granted")
    posthog?.opt_in_capturing()
    setIsVisible(false)
  }

  const handleReject = () => {
    window.localStorage.setItem(CONSENT_STORAGE_KEY, "denied")
    posthog?.opt_out_capturing()
    setIsVisible(false)
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-[90] px-4 pt-4 pb-8">
      <Card className="mx-auto w-full max-w-4xl gap-0 p-0 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <CardContent className="flex flex-col gap-3 p-4 text-center md:flex-row md:items-center md:justify-between md:gap-4 md:text-left">
          <p className="text-[14px] leading-[22px] md:text-[16px] md:leading-[24px] text-muted-foreground font-fk-grotesk">
            We use cookies and similar technologies to maintain security, estimate audience size, and improve the
            Website, Apps, and Tools. Learn more in our{" "}
            <Link href="/privacy" className="underline underline-offset-4 hover:opacity-70 transition-opacity">
              Privacy Policy
            </Link>
            .
          </p>
          <div className="grid w-full grid-cols-2 gap-2 md:flex md:w-auto md:flex-col md:items-end">
            <Button variant="outline" className="w-full md:w-auto" onClick={handleReject}>
              Reject
            </Button>
            <Button className="w-full md:w-auto" onClick={handleAccept}>
              Accept
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
