"use client"

import { NearWalletProvider, DiscourseProvider } from "@near-citizens/shared"
import { ErrorBoundary } from "@near-citizens/ui"

interface ProvidersProps {
  children: React.ReactNode
}

export function Providers({ children }: ProvidersProps) {
  return (
    <NearWalletProvider>
      <DiscourseProvider>
        <ErrorBoundary>{children}</ErrorBoundary>
      </DiscourseProvider>
    </NearWalletProvider>
  )
}
