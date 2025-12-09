"use client"

import { SWRConfig } from "swr"
import { NearWalletProvider } from "@near-citizens/shared"
import { ErrorBoundary } from "@near-citizens/ui"

interface ProvidersProps {
  children: React.ReactNode
}

export function Providers({ children }: ProvidersProps) {
  return (
    <SWRConfig
      value={{
        revalidateOnFocus: false,
        revalidateOnReconnect: false,
        dedupingInterval: 60000, // 1 minute deduplication
      }}
    >
      <NearWalletProvider>
        <ErrorBoundary>{children}</ErrorBoundary>
      </NearWalletProvider>
    </SWRConfig>
  )
}
