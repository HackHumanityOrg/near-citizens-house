"use client"

/**
 * Route-Level Error Boundary
 *
 * This component catches errors that occur in route components and sends them to PostHog.
 * Unlike global-error.tsx, this runs within the root layout so styling is preserved.
 *
 * @see https://nextjs.org/docs/app/building-your-application/routing/error-handling#using-error-boundaries
 * @see https://posthog.com/docs/error-tracking/installation/nextjs
 */

import posthog from "posthog-js"
import { useEffect } from "react"

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Capture the exception in PostHog
    posthog.captureException(error, {
      error_boundary: "route",
      error_digest: error.digest,
    })
  }, [error])

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="text-center p-8 max-w-md">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Something went wrong</h1>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          An error occurred while loading this page. Please try again or go back to the home page.
        </p>
        <div className="flex gap-4 justify-center">
          <button
            onClick={() => reset()}
            className="px-4 py-2 bg-yellow-400 hover:bg-yellow-500 text-black font-medium rounded-lg transition-colors"
          >
            Try again
          </button>
          <a
            href="/"
            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white font-medium rounded-lg transition-colors"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  )
}
