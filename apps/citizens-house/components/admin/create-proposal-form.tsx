"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
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
  Textarea,
  Label,
  Alert,
} from "@near-citizens/ui"
import { type TransformedPolicy, formatProposalBond } from "@near-citizens/shared"
import { useAdminActions } from "@/hooks/admin-actions"
import { getPolicy } from "@/lib/actions/sputnik-dao"
import { Loader2, FileText, CheckCircle, AlertCircle } from "lucide-react"

const createProposalSchema = z.object({
  description: z
    .string()
    .min(1, "Description is required")
    .max(10000, "Description must be less than 10,000 characters"),
})

type CreateProposalFormData = z.infer<typeof createProposalSchema>

export function CreateProposalForm() {
  const router = useRouter()
  const { createProposal, isLoading, error, clearError } = useAdminActions()
  const [policy, setPolicy] = useState<TransformedPolicy | null>(null)
  const [success, setSuccess] = useState<{ proposalId: number } | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isValid },
  } = useForm<CreateProposalFormData>({
    mode: "onChange",
    resolver: zodResolver(createProposalSchema),
    defaultValues: {
      description: "",
    },
  })

  // eslint-disable-next-line react-hooks/incompatible-library -- React Hook Form's watch() is incompatible with React Compiler memoization, this is expected
  const description = watch("description")
  const charCount = description?.length || 0

  // Fetch policy to get proposal bond
  useEffect(() => {
    async function fetchPolicy() {
      try {
        const daoPolicy = await getPolicy()
        setPolicy(daoPolicy)
      } catch (err) {
        console.error("Error fetching policy:", err)
      }
    }
    fetchPolicy()
  }, [])

  const onSubmit = async (data: CreateProposalFormData) => {
    clearError()
    setSuccess(null)

    try {
      // Use policy bond directly in yoctoNEAR to avoid floating point precision issues
      // Default: 0.1 NEAR = 100000000000000000000000 yoctoNEAR
      const bondYocto = policy?.proposalBond || "100000000000000000000000"

      const proposalId = await createProposal(data.description, bondYocto)
      setSuccess({ proposalId })
      reset()

      // Navigate to proposal after short delay
      if (proposalId >= 0) {
        setTimeout(() => {
          router.push(`/proposals/${proposalId}`)
        }, 2000)
      }
    } catch {
      // Error is set by hook
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Create Vote Proposal
        </CardTitle>
        <CardDescription>Create a text-only governance proposal for citizens to vote on.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="description">Proposal Description</Label>
              <span className={`text-xs ${charCount > 9000 ? "text-destructive" : "text-muted-foreground"}`}>
                {charCount} / 10,000
              </span>
            </div>
            <Textarea
              id="description"
              placeholder="Describe the proposal... (Markdown supported)"
              rows={8}
              {...register("description")}
              disabled={isLoading}
            />
            {errors.description && <p className="text-sm text-destructive">{errors.description.message}</p>}
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
              <div>
                <p className="font-medium">Proposal created successfully!</p>
                <p className="text-sm">Proposal ID: {success.proposalId}. Redirecting...</p>
              </div>
            </Alert>
          )}

          <Button type="submit" disabled={isLoading || !isValid} className="w-full">
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating Proposal...
              </>
            ) : (
              <>
                <FileText className="mr-2 h-4 w-4" />
                Create Proposal
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
