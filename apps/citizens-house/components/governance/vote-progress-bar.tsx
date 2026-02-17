"use client"

import { Check, Minus, Users } from "lucide-react"
import { VOTE_CHOICE_COLOR_TOKENS } from "./vote-colors"

interface Props {
  yesVotes: number
  noVotes: number
  quorumBps: number
  snapshotVerifiedCount: number
}

export function VoteProgressBar({ yesVotes, noVotes, quorumBps, snapshotVerifiedCount }: Props) {
  const totalVotes = yesVotes + noVotes
  const yesPct = totalVotes > 0 ? (yesVotes / totalVotes) * 100 : 0
  const noPct = totalVotes > 0 ? (noVotes / totalVotes) * 100 : 0
  const quorumRequired = Math.ceil((snapshotVerifiedCount * quorumBps) / 10_000)
  const quorumMet = totalVotes >= quorumRequired

  const compact = new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 2,
  })
  const formatCount = (value: number) => compact.format(value)

  return (
    <div className="flex flex-col gap-5">
      <div className="relative h-2 overflow-hidden rounded-full bg-[#dce3ea] dark:bg-white/10">
        {totalVotes > 0 && (
          <div className="flex h-full w-full">
            <div
              className={`h-full transition-all ${VOTE_CHOICE_COLOR_TOKENS.yes.progressSegment}`}
              style={{ width: `${yesPct}%` }}
            />
            <div
              className={`h-full transition-all ${VOTE_CHOICE_COLOR_TOKENS.no.progressSegment}`}
              style={{ width: `${noPct}%` }}
            />
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex min-h-6 items-center justify-between gap-3">
          <div className="flex min-h-6 items-center gap-3">
            <span
              className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${VOTE_CHOICE_COLOR_TOKENS.yes.legendChip}`}
            />
            <span className={`font-fk-grotesk text-[15px] leading-none ${VOTE_CHOICE_COLOR_TOKENS.yes.text}`}>Yes</span>
          </div>
          <span className="font-inter text-[15px] leading-none text-[#1e293b] dark:text-white">
            {formatCount(yesVotes)}
          </span>
        </div>

        <div className="flex min-h-6 items-center justify-between gap-3">
          <div className="flex min-h-6 items-center gap-3">
            <span
              className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${VOTE_CHOICE_COLOR_TOKENS.no.legendChip}`}
            />
            <span className={`font-fk-grotesk text-[15px] leading-none ${VOTE_CHOICE_COLOR_TOKENS.no.text}`}>No</span>
          </div>
          <span className="font-inter text-[15px] leading-none text-[#1e293b] dark:text-white">
            {formatCount(noVotes)}
          </span>
        </div>

        <div className="flex min-h-6 items-center justify-between gap-3">
          <div className="flex min-h-6 items-center gap-3">
            <span
              className={`inline-flex h-5 w-5 items-center justify-center rounded-full ${
                quorumMet ? "bg-[#dcfce7] dark:bg-[#14532d]" : "bg-[#e2e8f0] dark:bg-[#334155]"
              }`}
            >
              {quorumMet ? (
                <Check className="block h-3.5 w-3.5 text-[#166534] dark:text-[#bbf7d0]" strokeWidth={3} />
              ) : (
                <Minus className="block h-3.5 w-3.5 text-[#64748b] dark:text-[#cbd5e1]" strokeWidth={3} />
              )}
            </span>
            <span className="font-fk-grotesk text-[15px] leading-none text-[#1e293b] dark:text-white">Quorum</span>
          </div>
          <span className="font-inter text-[15px] leading-none text-[#1e293b] dark:text-white">
            {formatCount(totalVotes)} of {formatCount(quorumRequired)}
          </span>
        </div>

        <div className="flex min-h-6 items-center justify-between gap-3">
          <div className="flex min-h-6 items-center gap-3">
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#e2e8f0] dark:bg-[#334155]">
              <Users className="block h-3.5 w-3.5 text-[#64748b] dark:text-[#cbd5e1]" strokeWidth={2.5} />
            </span>
            <span className="font-fk-grotesk text-[15px] leading-none text-[#1e293b] dark:text-white">
              Qualified Citizens
            </span>
          </div>
          <span className="font-inter text-[15px] leading-none text-[#1e293b] dark:text-white">
            {formatCount(snapshotVerifiedCount)}
          </span>
        </div>
      </div>
    </div>
  )
}
