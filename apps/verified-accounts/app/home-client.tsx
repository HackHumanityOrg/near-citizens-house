"use client"

import { NearWalletProvider, DiscourseProvider } from "@near-citizens/shared"
import { ErrorBoundary } from "@near-citizens/ui"
import { IdentityVerificationFlow } from "@/components/home/identity-verification-flow"

export function HomePageClient() {
  return (
    <NearWalletProvider>
      <DiscourseProvider>
        <ErrorBoundary>
          <IdentityVerificationFlow />
        </ErrorBoundary>
      </DiscourseProvider>
    </NearWalletProvider>
  )
}
