"use client"

import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { createProposalRequestSchema, type CreateProposalRequest, APP_URLS } from "@near-citizens/shared"
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Input,
  Textarea,
  Label,
} from "@near-citizens/ui"
import { Loader2, AlertCircle } from "lucide-react"
import { useGovernance } from "@/hooks/governance"

interface CreateProposalFormProps {
  isVerified: boolean
  totalCitizens: number
  quorumPercentageMin: number
  quorumPercentageMax: number
  quorumPercentageDefault: number
}

export function CreateProposalForm({
  isVerified,
  totalCitizens,
  quorumPercentageMin,
  quorumPercentageMax,
  quorumPercentageDefault,
}: CreateProposalFormProps) {
  const router = useRouter()
  const { createProposal, isLoading, error, clearError } = useGovernance()

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<CreateProposalRequest>({
    resolver: zodResolver(createProposalRequestSchema),
    defaultValues: {
      quorumPercentage: quorumPercentageDefault,
    },
  })

  // eslint-disable-next-line react-hooks/incompatible-library -- React Hook Form's watch() is incompatible with React Compiler memoization, this is expected
  const titleLength = watch("title")?.length || 0
  const descriptionLength = watch("description")?.length || 0
  const quorumPercentage = watch("quorumPercentage") || quorumPercentageDefault

  // Calculate how many votes are needed for quorum
  const requiredVotes = Math.ceil((totalCitizens * quorumPercentage) / 100)

  const onSubmit = async (data: CreateProposalRequest) => {
    clearError()

    try {
      const proposalId = await createProposal(data.title, data.description, data.quorumPercentage, data.discourseUrl)

      // Redirect to the new proposal
      router.push(`/proposals/${proposalId}`)
    } catch {
      // Error is already set by the hook
    }
  }

  if (!isVerified) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Verification Required</CardTitle>
          <CardDescription>You must be a verified citizen to create proposals</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-3 p-4 border rounded-lg bg-muted/50">
            <AlertCircle className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div>
              <p className="text-sm text-muted-foreground">
                Please complete identity verification first. Visit the{" "}
                <a
                  href={APP_URLS.verification}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  Verified Accounts
                </a>{" "}
                app to verify your passport.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create New Proposal</CardTitle>
        <CardDescription>
          Submit a proposal for the community to vote on. All proposals run for 7 days. You can set a custom quorum
          requirement.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">
              Title <span className="text-destructive">*</span>
            </Label>
            <Input id="title" {...register("title")} placeholder="Enter a clear, concise title" disabled={isLoading} />
            <div className="flex justify-between text-xs">
              <span className="text-destructive">{errors.title?.message}</span>
              <span className={titleLength > 200 ? "text-destructive" : "text-muted-foreground"}>
                {titleLength} / 200
              </span>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">
              Description <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="description"
              {...register("description")}
              placeholder="Provide a detailed description of your proposal..."
              rows={10}
              disabled={isLoading}
            />
            <div className="flex justify-between text-xs">
              <span className="text-destructive">{errors.description?.message}</span>
              <span className={descriptionLength > 10000 ? "text-destructive" : "text-muted-foreground"}>
                {descriptionLength} / 10,000
              </span>
            </div>
          </div>

          {/* Discourse URL */}
          <div className="space-y-2">
            <Label htmlFor="discourseUrl">Discussion URL (Optional)</Label>
            <Input
              id="discourseUrl"
              {...register("discourseUrl")}
              placeholder="https://forum.example.com/t/..."
              disabled={isLoading}
            />
            <p className="text-xs text-muted-foreground">Link to a Discourse forum topic for discussion</p>
            {errors.discourseUrl && <p className="text-xs text-destructive">{errors.discourseUrl.message}</p>}
          </div>

          {/* Quorum Percentage */}
          <div className="space-y-2">
            <Label htmlFor="quorumPercentage">
              Quorum Requirement <span className="text-destructive">*</span>
            </Label>
            <div className="flex items-center gap-3">
              <Input
                id="quorumPercentage"
                type="number"
                min={quorumPercentageMin}
                max={quorumPercentageMax}
                {...register("quorumPercentage", { valueAsNumber: true })}
                className="w-24"
                disabled={isLoading}
              />
              <span className="text-sm text-muted-foreground">
                % of verified citizens ({quorumPercentageMin}-{quorumPercentageMax}%)
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {totalCitizens > 0 ? (
                <>
                  Currently <strong>{totalCitizens}</strong> verified citizens. At {quorumPercentage}%,{" "}
                  <strong>{requiredVotes}</strong> Yes/No votes are needed to reach quorum.
                </>
              ) : (
                "Loading citizen count..."
              )}
            </p>
            {errors.quorumPercentage && <p className="text-xs text-destructive">{errors.quorumPercentage.message}</p>}
          </div>

          {/* Error Display */}
          {error && (
            <div className="flex items-start gap-3 p-4 border border-destructive rounded-lg bg-destructive/10">
              <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
              <div>
                <p className="text-sm text-destructive">{error}</p>
              </div>
            </div>
          )}

          {/* Submit Button */}
          <div className="flex gap-4">
            <Button type="submit" disabled={isLoading} className="flex-1">
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating Proposal...
                </>
              ) : (
                "Create Proposal"
              )}
            </Button>
            <Button type="button" variant="outline" onClick={() => router.back()} disabled={isLoading}>
              Cancel
            </Button>
          </div>

          {/* Info Notice */}
          <div className="p-4 bg-muted/50 rounded-lg space-y-2">
            <p className="text-sm text-muted-foreground">
              <strong>Note:</strong> Once created, proposals cannot be edited. Make sure all details are correct before
              submitting. You can cancel your proposal while voting is active.
            </p>
            <p className="text-sm text-muted-foreground">
              <strong>Voting:</strong> Citizens can vote Yes, No, or Abstain. Only Yes and No votes count toward quorum.
              Proposals pass if Yes votes exceed No votes when quorum is met.
            </p>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
