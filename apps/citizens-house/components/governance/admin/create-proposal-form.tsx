"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Button, Input, Label } from "@near-citizens/ui"
import { useNearWallet } from "@/lib"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { yoctoToNear } from "@/lib/schemas/governance-contract"
import { formatUtcDateTime, parseDatetimeLocalToEpochMs } from "@/lib/governance-dates"
import { buildCreateProposalTx } from "@/lib/contracts/governance/transactions"
import {
  firstCreateProposalValidationError,
  formatSecondsDuration,
  utf8ByteLength,
  validateCreateProposalInput,
} from "@/lib/governance-proposal-validation"
import { revalidateGovernance } from "@/app/governance/actions"
import { MarkdownContent } from "@/components/governance/markdown-content"

interface Props {
  minProposalBond: string // yoctoNEAR
  maxStartDelaySecs: number
}

export function CreateProposalForm({ minProposalBond, maxStartDelaySecs }: Props) {
  const router = useRouter()
  const { signAndSendTransaction, accountId, isConnected } = useNearWallet()
  const [isPending, startTransition] = useTransition()

  const [title, setTitle] = useState("")
  const [author, setAuthor] = useState("")
  const [description, setDescription] = useState("")
  const [descriptionMode, setDescriptionMode] = useState<"edit" | "preview">("edit")
  const [scheduled, setScheduled] = useState(true)
  const [startAt, setStartAt] = useState("")
  const [bondNear, setBondNear] = useState("")
  const [submitAttempted, setSubmitAttempted] = useState(false)
  const [txLoading, setTxLoading] = useState(false)

  const loading = txLoading || isPending
  const selectedStartMs = startAt ? parseDatetimeLocalToEpochMs(startAt) : null

  const minBondNear = yoctoToNear(minProposalBond)
  const titleByteLength = utf8ByteLength(title)
  const authorByteLength = utf8ByteLength(author)
  const descriptionByteLength = utf8ByteLength(description)
  const maxStartDelayLabel = formatSecondsDuration(maxStartDelaySecs)
  const validation = validateCreateProposalInput({
    title,
    author,
    description,
    scheduled,
    startAt,
    bondNear,
    minProposalBondYocto: minProposalBond,
    maxStartDelaySecs,
    nowMs: Date.now(),
  })

  const showTitleError = submitAttempted && Boolean(validation.errors.title)
  const showAuthorError = submitAttempted && Boolean(validation.errors.author)
  const showDescriptionError = submitAttempted && Boolean(validation.errors.description)
  const showStartAtError = submitAttempted && Boolean(validation.errors.startAt)
  const hasUserInteracted = Boolean(title || author || description || startAt || bondNear)
  const showBondError = (submitAttempted || hasUserInteracted) && Boolean(validation.errors.bondNear)
  const firstValidationError = firstCreateProposalValidationError(validation.errors)
  const submitDisabled = loading || !validation.isValid

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isConnected || !accountId) {
      toast.error("Connect your wallet to create a proposal.")
      return
    }

    const submissionValidation = validateCreateProposalInput({
      title,
      author,
      description,
      scheduled,
      startAt,
      bondNear,
      minProposalBondYocto: minProposalBond,
      maxStartDelaySecs,
      nowMs: Date.now(),
    })
    if (!submissionValidation.isValid || !submissionValidation.normalized) {
      setSubmitAttempted(true)
      toast.error(
        firstCreateProposalValidationError(submissionValidation.errors) ?? "Please fix the highlighted fields.",
      )
      return
    }

    setSubmitAttempted(false)
    const {
      title: normalizedTitle,
      author: normalizedAuthor,
      description: normalizedDescription,
      bondYocto,
      startAtNs,
    } = submissionValidation.normalized

    setTxLoading(true)
    try {
      await signAndSendTransaction(
        buildCreateProposalTx(normalizedTitle, normalizedAuthor, normalizedDescription, bondYocto, startAtNs),
      )
      startTransition(() => {
        revalidateGovernance()
      })
      toast.success("Proposal created successfully")
      router.push("/governance")
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Transaction failed"
      toast.error(errorMessage)
    } finally {
      setTxLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6 w-full">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="title" className="font-fk-grotesk text-[14px] text-black dark:text-white">
            Title
          </Label>
          <span
            className={`text-[12px] font-inter ${
              titleByteLength > 140 ? "text-[#991b1b] dark:text-[#fecaca]" : "text-[#64748b] dark:text-[#94a3b8]"
            }`}
          >
            {titleByteLength}/140 bytes
          </span>
        </div>
        <Input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Proposal title"
          aria-invalid={showTitleError}
          className={showTitleError ? "border-[#ef4444] focus-visible:ring-[#ef4444]" : undefined}
        />
        {showTitleError && (
          <p className="text-[12px] text-[#991b1b] dark:text-[#fecaca] font-inter">{validation.errors.title}</p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="author" className="font-fk-grotesk text-[14px] text-black dark:text-white">
            Author
          </Label>
          <span
            className={`text-[12px] font-inter ${
              authorByteLength > 120 ? "text-[#991b1b] dark:text-[#fecaca]" : "text-[#64748b] dark:text-[#94a3b8]"
            }`}
          >
            {authorByteLength}/120 bytes
          </span>
        </div>
        <Input
          id="author"
          value={author}
          onChange={(e) => setAuthor(e.target.value)}
          placeholder="Author name"
          aria-invalid={showAuthorError}
          className={showAuthorError ? "border-[#ef4444] focus-visible:ring-[#ef4444]" : undefined}
        />
        {showAuthorError && (
          <p className="text-[12px] text-[#991b1b] dark:text-[#fecaca] font-inter">{validation.errors.author}</p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="description" className="font-fk-grotesk text-[14px] text-black dark:text-white">
            Description
          </Label>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setDescriptionMode("edit")}
                className={`px-2 py-1 text-[12px] rounded-md border transition-colors ${
                  descriptionMode === "edit"
                    ? "bg-black text-white dark:bg-white dark:text-black border-transparent"
                    : "bg-transparent text-[#64748b] border-input hover:bg-[#f8fafc] dark:hover:bg-white/[0.03]"
                }`}
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => setDescriptionMode("preview")}
                className={`px-2 py-1 text-[12px] rounded-md border transition-colors ${
                  descriptionMode === "preview"
                    ? "bg-black text-white dark:bg-white dark:text-black border-transparent"
                    : "bg-transparent text-[#64748b] border-input hover:bg-[#f8fafc] dark:hover:bg-white/[0.03]"
                }`}
              >
                Preview
              </button>
            </div>
            <span
              className={`text-[12px] font-inter ${
                descriptionByteLength > 10_000
                  ? "text-[#991b1b] dark:text-[#fecaca]"
                  : "text-[#64748b] dark:text-[#94a3b8]"
              }`}
            >
              {descriptionByteLength}/10000 bytes
            </span>
          </div>
        </div>
        {descriptionMode === "edit" ? (
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the proposal..."
            rows={8}
            aria-invalid={showDescriptionError}
            className={`flex w-full rounded-md border bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-y ${
              showDescriptionError ? "border-[#ef4444] focus-visible:ring-[#ef4444]" : "border-input"
            }`}
          />
        ) : (
          <div className="bg-white dark:bg-[#191a23] border border-[rgba(0,0,0,0.1)] dark:border-white/20 rounded-[16px] p-6 min-h-[220px]">
            {description.trim() ? (
              <MarkdownContent>{description}</MarkdownContent>
            ) : (
              <p className="text-[14px] text-[#64748b] dark:text-[#94a3b8] font-inter">
                Nothing to preview yet. Add description content in Edit mode.
              </p>
            )}
          </div>
        )}
        {showDescriptionError && (
          <p className="text-[12px] text-[#991b1b] dark:text-[#fecaca] font-inter">{validation.errors.description}</p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label className="font-fk-grotesk text-[14px] text-black dark:text-white">Voting Start (UTC)</Label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setScheduled(true)}
            className={`flex-1 px-3 py-2 text-sm rounded-md border transition-colors ${
              scheduled
                ? "bg-black text-white dark:bg-white dark:text-black border-transparent"
                : "bg-transparent text-[#64748b] border-input hover:bg-[#f8fafc] dark:hover:bg-white/[0.03]"
            }`}
          >
            Scheduled
          </button>
          <button
            type="button"
            onClick={() => {
              setScheduled(false)
              setStartAt("")
            }}
            className={`flex-1 px-3 py-2 text-sm rounded-md border transition-colors ${
              !scheduled
                ? "bg-black text-white dark:bg-white dark:text-black border-transparent"
                : "bg-transparent text-[#64748b] border-input hover:bg-[#f8fafc] dark:hover:bg-white/[0.03]"
            }`}
          >
            Immediately
          </button>
        </div>
        {scheduled && (
          <Input
            id="startAt"
            type="datetime-local"
            value={startAt}
            onChange={(e) => setStartAt(e.target.value)}
            aria-invalid={showStartAtError}
            className={showStartAtError ? "border-[#ef4444] focus-visible:ring-[#ef4444]" : undefined}
          />
        )}
        {scheduled && startAt && selectedStartMs !== null && (
          <p className="text-[12px] text-[#64748b] dark:text-[#94a3b8] font-inter">
            UTC preview: {formatUtcDateTime(selectedStartMs)}
          </p>
        )}
        <p className="text-[12px] text-[#64748b] dark:text-[#94a3b8] font-inter">
          {scheduled
            ? `Choose a UTC date/time. Must be within ${maxStartDelayLabel} from now.`
            : "Voting opens as soon as the proposal is confirmed on-chain."}
        </p>
        {showStartAtError && (
          <p className="text-[12px] text-[#991b1b] dark:text-[#fecaca] font-inter">{validation.errors.startAt}</p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="bond" className="font-fk-grotesk text-[14px] text-black dark:text-white">
          Bond (NEAR)
        </Label>
        <Input
          id="bond"
          type="text"
          inputMode="decimal"
          value={bondNear}
          onChange={(e) => setBondNear(e.target.value)}
          placeholder={`Min: ${minBondNear} NEAR`}
          aria-invalid={showBondError}
          className={showBondError ? "border-[#ef4444] focus-visible:ring-[#ef4444]" : undefined}
        />
        <p className="text-[12px] text-[#64748b] dark:text-[#94a3b8] font-inter">
          Minimum bond: {minBondNear} NEAR. Non-refundable. Covers storage costs.
        </p>
        {showBondError && (
          <p className="text-[12px] text-[#991b1b] dark:text-[#fecaca] font-inter">{validation.errors.bondNear}</p>
        )}
      </div>

      <Button variant="citizens-primary" size="citizens-lg" type="submit" disabled={submitDisabled}>
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Create Proposal
      </Button>
      {!loading && hasUserInteracted && !validation.isValid && firstValidationError && (
        <p className="text-[12px] text-[#991b1b] dark:text-[#fecaca] font-inter">{firstValidationError}</p>
      )}
    </form>
  )
}
