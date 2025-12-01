"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { createProposalRequestSchema, type CreateProposalRequest } from "@near-citizens/shared"
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

interface CreateProposalFormProps {
  isVerified: boolean
}

export function CreateProposalForm({ isVerified }: CreateProposalFormProps) {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<CreateProposalRequest>({
    resolver: zodResolver(createProposalRequestSchema),
  })

  const titleLength = watch("title")?.length || 0
  const descriptionLength = watch("description")?.length || 0

  const onSubmit = async (data: CreateProposalRequest) => {
    setSubmitting(true)
    setError(null)

    try {
      const response = await fetch("/api/governance/proposals/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const result = await response.json()
        throw new Error(result.error || "Failed to create proposal")
      }

      const result = await response.json()

      // Redirect to the new proposal
      router.push(`/proposals/${result.proposalId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create proposal")
      setSubmitting(false)
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
                <a href="/" className="text-primary hover:underline">
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
          Submit a proposal for the community to vote on. All proposals run for 7 days and require 10% participation to
          pass.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">
              Title <span className="text-destructive">*</span>
            </Label>
            <Input id="title" {...register("title")} placeholder="Enter a clear, concise title" disabled={submitting} />
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
              disabled={submitting}
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
              disabled={submitting}
            />
            <p className="text-xs text-muted-foreground">Link to a Discourse forum topic for discussion</p>
            {errors.discourseUrl && <p className="text-xs text-destructive">{errors.discourseUrl.message}</p>}
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
            <Button type="submit" disabled={submitting} className="flex-1">
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating Proposal...
                </>
              ) : (
                "Create Proposal"
              )}
            </Button>
            <Button type="button" variant="outline" onClick={() => router.back()} disabled={submitting}>
              Cancel
            </Button>
          </div>

          {/* Info Notice */}
          <div className="p-4 bg-muted/50 rounded-lg">
            <p className="text-sm text-muted-foreground">
              <strong>Note:</strong> Once created, proposals cannot be edited. Make sure all details are correct before
              submitting. You can cancel your proposal while voting is active.
            </p>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
