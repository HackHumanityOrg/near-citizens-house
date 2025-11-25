"use client"

import { NearWalletProvider } from "@/lib/near-wallet-provider"
import { DiscourseProvider } from "@/lib/discourse-provider"
import { VerificationFlow } from "@/components/verification-flow"
import { ErrorBoundary } from "@/components/error-boundary"
import { Shield, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { ThemeToggle } from "@/components/theme-toggle"
import Link from "next/link"

export default function HomePage() {
  return (
    <NearWalletProvider>
      <DiscourseProvider>
        <div className="min-h-screen overflow-clip bg-gradient-to-b from-background to-background/80">
          <div className="container mx-auto px-4 py-12">
            <div className="max-w-7xl mx-auto space-y-12">
              <div className="fixed top-4 right-4 z-50">
                <ThemeToggle />
              </div>

              <Card noBorder corners="dots" extendingLines="full" className="bg-transparent px-8">
                <CardContent className="text-center space-y-3 py-4">
                  <div className="flex items-center justify-center gap-3">
                    <Shield className="h-10 w-10 text-primary" aria-hidden="true" />
                  </div>
                  <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-balance">
                    Self x NEAR Verification
                  </h1>
                  <p className="text-lg text-muted-foreground max-w-2xl mx-auto text-pretty">
                    Link your real-world identity to your NEAR blockchain account using zero-knowledge passport proofs
                  </p>
                  <div className="pt-2">
                    <Link href="/verifications">
                      <Button variant="outline" size="lg" className="gap-2 px-8">
                        <Search className="h-4 w-4" aria-hidden="true" />
                        Browse Verified Accounts
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>

              <Card noBorder corners="dots" extendingLines="full" className="bg-transparent px-8">
                <CardContent className="py-8 flex justify-center">
                  <div className="max-w-2xl w-full">
                    <ErrorBoundary>
                      <VerificationFlow />
                    </ErrorBoundary>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </DiscourseProvider>
    </NearWalletProvider>
  )
}
