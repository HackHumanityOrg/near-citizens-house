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
import { type TransformedPolicy, formatProposalBond, nearAccountIdSchema } from "@near-citizens/shared"
import { useAdminActions } from "@/hooks/admin-actions"
import { getPolicy } from "@/lib/actions/sputnik-dao"
import { Loader2, UserPlus, CheckCircle, AlertCircle } from "lucide-react"

const addMemberSchema = z.object({
  accountId: nearAccountIdSchema,
})

type AddMemberFormData = z.infer<typeof addMemberSchema>

export function AddMemberForm() {
  const { addMember, isLoading, error, clearError } = useAdminActions()
  const [policy, setPolicy] = useState<TransformedPolicy | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AddMemberFormData>({
    resolver: zodResolver(addMemberSchema),
  })

  // Fetch policy to get proposal bond
  useEffect(() => {
    let isMounted = true

    async function fetchPolicy() {
      try {
        const daoPolicy = await getPolicy()
        if (isMounted) {
          setPolicy(daoPolicy)
        }
      } catch (err) {
        console.error("Error fetching policy:", err)
      }
    }
    fetchPolicy()

    return () => {
      isMounted = false
    }
  }, [])

  const onSubmit = async (data: AddMemberFormData) => {
    clearError()
    setSuccess(null)

    try {
      // Use policy bond directly in yoctoNEAR to avoid floating point precision issues
      // Default: 0.1 NEAR = 100000000000000000000000 yoctoNEAR
      const bondYocto = policy?.proposalBond || "100000000000000000000000"

      const txHash = await addMember(data.accountId, bondYocto)
      const txHashDisplay = typeof txHash === "string" && txHash.length > 0 ? `${txHash.slice(0, 8)}...` : "unknown"
      setSuccess(`Member ${data.accountId} added successfully! Transaction: ${txHashDisplay}`)
      reset()
    } catch {
      // Error is set by hook
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserPlus className="h-5 w-5" />
          Add Verified Member
        </CardTitle>
        <CardDescription>
          Add a verified account as a citizen member. The account must be verified first.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="accountId">NEAR Account ID</Label>
            <Input id="accountId" placeholder="alice.near" {...register("accountId")} disabled={isLoading} />
            {errors.accountId && <p className="text-sm text-destructive">{errors.accountId.message}</p>}
          </div>

          {/* Bond Info */}
          {policy && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <div>
                <p className="text-sm font-medium">Proposal Bond Required</p>
                <p className="text-sm text-muted-foreground">
                  This action requires {formatProposalBond(policy.proposalBond)} as a proposal bond. The bond is
                  returned when the proposal is finalized.
                </p>
              </div>
            </Alert>
          )}

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

          <Button type="submit" disabled={isLoading} className="w-full">
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Adding Member...
              </>
            ) : (
              <>
                <UserPlus className="mr-2 h-4 w-4" />
                Add Member
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
