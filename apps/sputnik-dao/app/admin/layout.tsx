"use client"

import { useNearWallet } from "@near-citizens/shared"
import { useIsAdmin } from "@/hooks/admin"
import { SputnikHeader } from "@/components/shared/sputnik-header"
import { AdminNav } from "@/components/admin/admin-nav"
import { Button, Card, CardHeader, CardTitle, CardContent } from "@near-citizens/ui"
import { Loader2, ShieldAlert, LogIn, Wallet } from "lucide-react"

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { accountId, connect, isLoading: walletLoading } = useNearWallet()
  const { isAdmin, backendWallet, loading: adminLoading } = useIsAdmin()

  // Show loading state
  if (walletLoading || adminLoading) {
    return (
      <div className="min-h-screen">
        <SputnikHeader />
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-12 w-12 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  // Show connect wallet prompt
  if (!accountId) {
    return (
      <div className="min-h-screen">
        <SputnikHeader />
        <div className="container mx-auto px-4 py-24 max-w-md">
          <Card>
            <CardHeader className="text-center">
              <Wallet className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <CardTitle>Connect Wallet</CardTitle>
            </CardHeader>
            <CardContent className="text-center space-y-4">
              <p className="text-muted-foreground">Please connect your wallet to access the admin panel.</p>
              <Button onClick={connect} className="w-full">
                <LogIn className="mr-2 h-4 w-4" />
                Connect Wallet
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // Show access denied
  if (!isAdmin) {
    return (
      <div className="min-h-screen">
        <SputnikHeader />
        <div className="container mx-auto px-4 py-24 max-w-md">
          <Card>
            <CardHeader className="text-center">
              <ShieldAlert className="h-12 w-12 mx-auto mb-4 text-destructive" />
              <CardTitle>Access Denied</CardTitle>
            </CardHeader>
            <CardContent className="text-center space-y-4">
              <p className="text-muted-foreground">You don&apos;t have permission to access the admin panel.</p>
              <div className="text-sm bg-muted p-3 rounded-lg">
                <p className="text-muted-foreground mb-1">Your wallet:</p>
                <code className="text-xs break-all">{accountId}</code>
              </div>
              {backendWallet && (
                <div className="text-sm bg-muted p-3 rounded-lg">
                  <p className="text-muted-foreground mb-1">Admin wallet:</p>
                  <code className="text-xs break-all">{backendWallet}</code>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // Show admin content
  return (
    <div className="min-h-screen">
      <SputnikHeader />
      <div className="flex">
        <AdminNav />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  )
}
