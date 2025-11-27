"use client"

import { NearWalletProvider } from "@/lib/near-wallet-provider"
import { DiscourseProvider } from "@/lib/discourse-provider"
import { IdentityVerificationFlow } from "@/components/home/identity-verification-flow"
import { ErrorBoundary } from "@/components/shared/error-boundary"

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
