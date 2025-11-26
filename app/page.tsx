"use client"

import { NearWalletProvider } from "@/lib/near-wallet-provider"
import { DiscourseProvider } from "@/lib/discourse-provider"
import { VerificationFlow } from "@/components/verification-flow"
import { ErrorBoundary } from "@/components/error-boundary"
import { ShieldCheck, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { ThemeToggle } from "@/components/theme-toggle"
import Link from "next/link"

export default function HomePage() {
  return (
    <NearWalletProvider>
      <DiscourseProvider>
        <div className="min-h-screen overflow-clip bg-gradient-to-b from-background to-background/80">
          <div className="container mx-auto px-4 py-12">
            <div className="max-w-7xl mx-auto space-y-4">
              <div className="fixed top-4 right-4 z-50">
                <ThemeToggle />
              </div>

              <Card className="border-0 bg-transparent shadow-none">
                <CardContent className="text-center space-y-3 py-4">
                  <div className="flex items-center justify-center">
                    <Badge className="gap-1.5 px-3 py-1 text-sm bg-[#00EC97]/15 text-[#00C08B] dark:bg-[#00EC97]/20 dark:text-[#00EC97] border-0 hover:bg-[#00EC97]/20">
                      <ShieldCheck className="h-5 w-5" aria-hidden="true" />
                      Identity Verification
                    </Badge>
                  </div>
                  <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
                    Become a Verified
                    <br />
                    <span className="text-[#00C08B] dark:text-[#00EC97]">NEAR Account</span>
                  </h1>
                  <p className="text-muted-foreground max-w-2xl mx-auto text-pretty">
                    Complete the verification process to participate in NEAR governance with enhanced trust and
                    credibility.
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

              <Card className="border-0 bg-transparent shadow-none">
                <CardContent className="pt-0 flex justify-center">
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
