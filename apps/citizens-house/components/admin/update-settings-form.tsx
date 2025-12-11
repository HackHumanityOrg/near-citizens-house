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
import { type BridgeInfo } from "@near-citizens/shared"
import { useAdminActions } from "@/hooks/admin-actions"
import { getBridgeInfo } from "@/lib/actions/bridge"
import { Loader2, Settings, CheckCircle, AlertCircle, AlertTriangle } from "lucide-react"

const updateBackendWalletSchema = z.object({
  newBackendWallet: z
    .string()
    .min(1, "Account ID is required")
    .regex(/^[a-z0-9_-]+(\.[a-z0-9_-]+)*$/, "Invalid NEAR account ID format"),
})

const updateCitizenRoleSchema = z.object({
  newRole: z.string().min(1, "Role name is required").max(100, "Role name too long"),
})

type UpdateBackendWalletData = z.infer<typeof updateBackendWalletSchema>
type UpdateCitizenRoleData = z.infer<typeof updateCitizenRoleSchema>

export function UpdateSettingsForm() {
  const { updateBackendWallet, updateCitizenRole, isLoading, error, clearError } = useAdminActions()
  const [info, setInfo] = useState<BridgeInfo | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [loadingInfo, setLoadingInfo] = useState(true)

  const backendWalletForm = useForm<UpdateBackendWalletData>({
    resolver: zodResolver(updateBackendWalletSchema),
  })

  const citizenRoleForm = useForm<UpdateCitizenRoleData>({
    resolver: zodResolver(updateCitizenRoleSchema),
  })

  // Fetch current info
  useEffect(() => {
    async function fetchInfo() {
      try {
        const bridgeInfo = await getBridgeInfo()
        setInfo(bridgeInfo)
        backendWalletForm.setValue("newBackendWallet", bridgeInfo.backendWallet)
        citizenRoleForm.setValue("newRole", bridgeInfo.citizenRole)
      } catch (err) {
        console.error("Error fetching bridge info:", err)
      } finally {
        setLoadingInfo(false)
      }
    }
    fetchInfo()
  }, [backendWalletForm, citizenRoleForm])

  const handleUpdateBackendWallet = async (data: UpdateBackendWalletData) => {
    clearError()
    setSuccess(null)

    try {
      await updateBackendWallet(data.newBackendWallet)
      setSuccess(`Backend wallet updated to ${data.newBackendWallet}`)
      setInfo((prev) => (prev ? { ...prev, backendWallet: data.newBackendWallet } : null))
    } catch {
      // Error is set by hook
    }
  }

  const handleUpdateCitizenRole = async (data: UpdateCitizenRoleData) => {
    clearError()
    setSuccess(null)

    try {
      await updateCitizenRole(data.newRole)
      setSuccess(`Citizen role updated to ${data.newRole}`)
      setInfo((prev) => (prev ? { ...prev, citizenRole: data.newRole } : null))
    } catch {
      // Error is set by hook
    }
  }

  if (loadingInfo) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
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

      {/* Update Citizen Role */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Update Citizen Role
          </CardTitle>
          <CardDescription>
            Change the role name used for citizens. Current role:{" "}
            <code className="bg-muted px-1 rounded">{info?.citizenRole}</code>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={citizenRoleForm.handleSubmit(handleUpdateCitizenRole)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="newRole">New Role Name</Label>
              <Input id="newRole" placeholder="citizen" {...citizenRoleForm.register("newRole")} disabled={isLoading} />
              {citizenRoleForm.formState.errors.newRole && (
                <p className="text-sm text-destructive">{citizenRoleForm.formState.errors.newRole.message}</p>
              )}
            </div>

            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                "Update Citizen Role"
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
        <Alert className="border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200">
          <CheckCircle className="h-4 w-4" />
          <p>{success}</p>
        </Alert>
      )}
    </div>
  )
}
