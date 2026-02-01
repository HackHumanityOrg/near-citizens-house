import type React from "react"
import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { VercelToolbar } from "@vercel/toolbar/next"
import { ThemeProvider } from "@near-citizens/ui"
import { UserJotWidget } from "@/lib"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { ConsentBanner } from "@/components/layout/consent-banner"
import { Toaster } from "@/components/ui/sonner"
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
  description:
    "Create your NEAR Verified Account to participate in NEAR governance with enhanced trust and credibility.",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    // suppressHydrationWarning required for next-themes - theme stored in localStorage causes hydration mismatch
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased flex flex-col min-h-screen bg-white dark:bg-[#181921]`}
      >
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
          <Providers>
            <Header />
            <main className="flex-1">{children}</main>
            <Footer />
            <ConsentBanner />
            <Toaster />
          </Providers>
        </ThemeProvider>
        <Analytics />
        <VercelToolbar />
        <UserJotWidget />
      </body>
    </html>
  )
}
