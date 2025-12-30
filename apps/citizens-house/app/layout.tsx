import type React from "react"
import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { VercelToolbar } from "@vercel/toolbar/next"
import { ThemeProvider, Footer } from "@near-citizens/ui"
import { UserJotWidget } from "@near-citizens/shared"
import { SputnikHeader } from "@/components/shared/sputnik-header"
import { BetaBanner } from "@/components/shared/beta-banner"
import { Providers } from "./providers"
import "./globals.css"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "optional",
  preload: true,
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "optional",
  preload: true,
})

export const metadata: Metadata = {
  title: "NEAR Citizens House",
  description: "Verify your identity with Self.xyz passport proof and link to your NEAR wallet",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    // suppressHydrationWarning required for next-themes - theme stored in localStorage causes hydration mismatch
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
          <Providers>
            <BetaBanner />
            <div className="pt-8">
              <SputnikHeader />
            </div>
            {children}
            <Footer />
          </Providers>
        </ThemeProvider>
        <Analytics />
        <VercelToolbar />
        <UserJotWidget />
      </body>
    </html>
  )
}
