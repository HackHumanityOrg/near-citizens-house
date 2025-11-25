"use client"

import { NearWalletProvider } from "@/lib/near-wallet-provider"
import { VerificationFlow } from "@/components/verification-flow"
import { ErrorBoundary } from "@/components/error-boundary"
import { Shield, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"

export default function HomePage() {
  return (
    <NearWalletProvider>
      <div className="h-screen overflow-hidden bg-gradient-to-b from-background to-background/80">
        <div className="container mx-auto px-4 h-full flex flex-col py-6">
          <div className="relative mb-6">
            <div className="text-center space-y-3">
              <div className="flex items-center justify-center gap-3 mb-2">
                <Shield className="h-10 w-10 text-primary" aria-hidden="true" />
              </div>
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-balance">Self x NEAR Verification</h1>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto text-pretty">
                Link your real-world identity to your NEAR blockchain account using zero-knowledge passport proofs
              </p>
            </div>

            <Link href="/verifications" className="absolute top-0 right-0">
              <Button variant="secondary" size="sm" className="gap-2">
                <Search className="h-4 w-4" aria-hidden="true" />
                View All
              </Button>
            </Link>
          </div>

          <div className="flex-1 flex items-start justify-center overflow-y-auto py-4">
            <div className="max-w-2xl w-full px-4">
              <ErrorBoundary>
                <VerificationFlow />
              </ErrorBoundary>
            </div>
          </div>
        </div>
      </div>
    </NearWalletProvider>
  )
}
