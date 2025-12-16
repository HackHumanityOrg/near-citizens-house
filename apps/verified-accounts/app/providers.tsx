"use client"

import { Suspense } from "react"
import { NearWalletProvider } from "@near-citizens/shared"
import { ErrorBoundary } from "@near-citizens/ui"
import { PostHogProvider, PostHogPageview } from "./posthog-provider"

interface ProvidersProps {
  children: React.ReactNode
}

export function Providers({ children }: ProvidersProps) {
  return (
    <PostHogProvider>
      <NearWalletProvider>
        <ErrorBoundary>
          <Suspense fallback={null}>
            <PostHogPageview />
          </Suspense>
          {children}
        </ErrorBoundary>
      </NearWalletProvider>
    </PostHogProvider>
  )
}
