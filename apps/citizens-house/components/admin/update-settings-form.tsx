"use client"

import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
  Button,
  Input,
  Label,
  Alert,
} from "@near-citizens/ui"
import { nearAccountIdSchema } from "@near-citizens/shared"
import { useAdminActions } from "@/hooks/admin-actions"
import { getBridgeInfo } from "@/lib/actions/bridge"
import { Loader2, Settings, CheckCircle, AlertCircle, AlertTriangle } from "lucide-react"

const updateBackendWalletSchema = z.object({
  newBackendWallet: nearAccountIdSchema,
})

type UpdateBackendWalletData = z.infer<typeof updateBackendWalletSchema>

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-[#e2e8f0] dark:bg-white/10 ${className}`} />
}

export function UpdateSettingsForm() {
  const { updateBackendWallet, isLoading, error, clearError } = useAdminActions()
  const [success, setSuccess] = useState<string | null>(null)
  const [loadingInfo, setLoadingInfo] = useState(true)

  const backendWalletForm = useForm<UpdateBackendWalletData>({
    resolver: zodResolver(updateBackendWalletSchema),
  })

  // Fetch current info
  useEffect(() => {
    async function fetchInfo() {
      try {
        const bridgeInfo = await getBridgeInfo()
        if (bridgeInfo) {
          backendWalletForm.setValue("newBackendWallet", bridgeInfo.backendWallet)
        }
      } catch (err) {
        console.error("Error fetching bridge info:", err)
      } finally {
        setLoadingInfo(false)
      }
    }
    fetchInfo()
  }, [backendWalletForm])

  const handleUpdateBackendWallet = async (data: UpdateBackendWalletData) => {
    clearError()
    setSuccess(null)

    try {
      await updateBackendWallet(data.newBackendWallet)
      setSuccess(`Backend wallet updated to ${data.newBackendWallet}`)
    } catch {
      // Error is set by hook
    }
  }

  if (loadingInfo) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-5 rounded" />
              <Skeleton className="h-6 w-48" />
            </div>
            <Skeleton className="h-4 w-72" />
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-muted bg-muted/40 p-4 space-y-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-10 w-full" />
            </div>
            <Skeleton className="h-10 w-44" />
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Update Backend Wallet */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Update Backend Wallet
          </CardTitle>
          <CardDescription>Change the wallet that has admin permissions on the bridge contract.</CardDescription>
        </CardHeader>
        <CardContent>
          <Alert className="mb-4 border-yellow-200 bg-yellow-50 text-yellow-800 dark:border-yellow-800 dark:bg-yellow-950 dark:text-yellow-200">
            <AlertTriangle className="h-4 w-4" />
            <div>
              <p className="text-sm font-medium">Warning: Irreversible Action</p>
              <p className="text-sm">
                Changing the backend wallet will transfer admin control. Make sure you have access to the new wallet.
              </p>
            </div>
          </Alert>

          <form onSubmit={backendWalletForm.handleSubmit(handleUpdateBackendWallet)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="newBackendWallet">New Backend Wallet</Label>
              <Input
                id="newBackendWallet"
                placeholder="new-admin.near"
                {...backendWalletForm.register("newBackendWallet")}
                disabled={isLoading}
              />
              {backendWalletForm.formState.errors.newBackendWallet && (
                <p className="text-sm text-destructive">
                  {backendWalletForm.formState.errors.newBackendWallet.message}
                </p>
              )}
            </div>

            <Button type="submit" disabled={isLoading} variant="destructive">
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                "Update Backend Wallet"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Error */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <p>{error}</p>
        </Alert>
      )}

      {/* Success */}
      {success && (
        <Alert className="border-green-200 bg-green-50 text-green-800 dark:border-green-700 dark:bg-green-900 dark:text-green-100">
          <CheckCircle className="h-4 w-4" />
          <p>{success}</p>
        </Alert>
      )}
    </div>
  )
}
