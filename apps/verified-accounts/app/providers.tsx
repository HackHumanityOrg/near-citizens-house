"use client"

import { NearWalletProvider } from "@near-citizens/shared"
import { ErrorBoundary } from "@near-citizens/ui"

interface ProvidersProps {
  children: React.ReactNode
}

export function Providers({ children }: ProvidersProps) {
  return (
    <NearWalletProvider>
      <ErrorBoundary>{children}</ErrorBoundary>
    </NearWalletProvider>
  )
}
