"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Button, Input, Label } from "@near-citizens/ui"
import { useNearWallet } from "@/lib"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { nearToYocto, yoctoToNear } from "@/lib/schemas/governance-contract"
import { epochMsToNanoseconds, formatUtcDateTime, parseDatetimeLocalToEpochMs } from "@/lib/governance-dates"
import { buildCreateProposalTx } from "@/lib/contracts/governance/transactions"
import { revalidateGovernance } from "@/app/governance/actions"
import { MarkdownContent } from "@/components/governance/markdown-content"

interface Props {
  minProposalBond: string // yoctoNEAR
}

export function CreateProposalForm({ minProposalBond }: Props) {
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
  const [txLoading, setTxLoading] = useState(false)

  const loading = txLoading || isPending
  const selectedStartMs = startAt ? parseDatetimeLocalToEpochMs(startAt) : null

  // Convert minProposalBond (yoctoNEAR) to NEAR for display
  const minBondNear = parseFloat(yoctoToNear(minProposalBond))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isConnected || !accountId) return

    if (!title.trim() || !author.trim() || !description.trim()) {
      toast.error("Please fill in all required fields")
      return
    }
    if (scheduled && !startAt) {
      toast.error("Please choose a voting start date and time")
      return
    }

    setTxLoading(true)
    try {
      const bondYocto = bondNear ? nearToYocto(bondNear) : minProposalBond
      let startAtNs: string | undefined
      if (startAt) {
        const startMs = parseDatetimeLocalToEpochMs(startAt)
        if (startMs === null) {
          toast.error("Invalid voting start date and time")
          return
        }
        startAtNs = epochMsToNanoseconds(startMs)
      }

      await signAndSendTransaction(
        buildCreateProposalTx(title.trim(), author.trim(), description.trim(), bondYocto, startAtNs),
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
          <span className="text-[12px] text-[#64748b] dark:text-[#94a3b8] font-inter">{title.length}/140</span>
        </div>
        <Input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value.slice(0, 140))}
          placeholder="Proposal title"
          maxLength={140}
          required
        />
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="author" className="font-fk-grotesk text-[14px] text-black dark:text-white">
            Author
          </Label>
          <span className="text-[12px] text-[#64748b] dark:text-[#94a3b8] font-inter">{author.length}/120</span>
        </div>
        <Input
          id="author"
          value={author}
          onChange={(e) => setAuthor(e.target.value.slice(0, 120))}
          placeholder="Author name"
          maxLength={120}
          required
        />
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
            <span className="text-[12px] text-[#64748b] dark:text-[#94a3b8] font-inter">
              {description.length}/10000
            </span>
          </div>
        </div>
        {descriptionMode === "edit" ? (
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value.slice(0, 10000))}
            placeholder="Describe the proposal..."
            maxLength={10000}
            required
            rows={8}
            className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-y"
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
            required={scheduled}
          />
        )}
        {scheduled && startAt && selectedStartMs !== null && (
          <p className="text-[12px] text-[#64748b] dark:text-[#94a3b8] font-inter">
            UTC preview: {formatUtcDateTime(selectedStartMs)}
          </p>
        )}
        <p className="text-[12px] text-[#64748b] dark:text-[#94a3b8] font-inter">
          {scheduled
            ? "Choose a UTC date/time. This value is submitted on-chain as UTC."
            : "Voting opens as soon as the proposal is confirmed on-chain."}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="bond" className="font-fk-grotesk text-[14px] text-black dark:text-white">
          Bond (NEAR)
        </Label>
        <Input
          id="bond"
          type="number"
          step="0.01"
          min={minBondNear}
          value={bondNear}
          onChange={(e) => setBondNear(e.target.value)}
          placeholder={`Min: ${minBondNear} NEAR`}
        />
        <p className="text-[12px] text-[#64748b] dark:text-[#94a3b8] font-inter">
          Minimum bond: {minBondNear} NEAR. Non-refundable. Covers storage costs.
        </p>
      </div>

      <Button variant="citizens-primary" size="citizens-lg" type="submit" disabled={loading}>
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Create Proposal
      </Button>
    </form>
  )
}
