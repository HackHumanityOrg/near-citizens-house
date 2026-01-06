"use client"

/**
 * Global Error Boundary for Root Layout
 *
 * This component catches errors that occur in the root layout and sends them to PostHog.
 * It must include its own <html> and <body> tags since it replaces the root layout on error.
 *
 * @see https://nextjs.org/docs/app/building-your-application/routing/error-handling#handling-global-errors
 * @see https://posthog.com/docs/error-tracking/installation/nextjs
 */

import posthog from "posthog-js"
import { useEffect } from "react"

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Capture the exception in PostHog
    posthog.captureException(error, {
      error_boundary: "global",
      error_digest: error.digest,
    })
  }, [error])

  return (
    <html lang="en">
      <body className="min-h-screen bg-white dark:bg-black flex items-center justify-center">
        <div className="text-center p-8 max-w-md">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Something went wrong</h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            An unexpected error occurred. Please try again or contact support if the problem persists.
          </p>
          <button
            onClick={() => reset()}
            className="px-4 py-2 bg-yellow-400 hover:bg-yellow-500 text-black font-medium rounded-lg transition-colors cursor-pointer"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  )
}
