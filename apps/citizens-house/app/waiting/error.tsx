"use client"

import { useEffect } from "react"
import * as Sentry from "@sentry/nextjs"
import { Button } from "@near-citizens/ui"
import { captureError } from "@/lib/analytics"

export default function WaitingError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    captureError(error, { stage: "client_render" })
    Sentry.captureException(error, {
      tags: { route: "/waiting" },
    })
  }, [error])

  return (
    <div className="flex min-h-[40vh] items-center justify-center px-6">
      <div className="flex max-w-[520px] flex-col items-center gap-4 text-center">
        <h2 className="text-2xl font-medium text-[#111] dark:text-[#f5f7fa]">Unable to load waiting page</h2>
        <p className="text-base text-[#757575] dark:text-[#8a8f98]">
          Something went wrong while loading this route. Please try again.
        </p>
        <Button onClick={() => reset()} variant="citizens-primary" size="citizens-lg">
          Retry
        </Button>
      </div>
    </div>
  )
}
