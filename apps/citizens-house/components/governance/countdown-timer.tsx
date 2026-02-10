"use client"

import { useState, useEffect } from "react"

interface Props {
  targetMs: number
  label?: string
  endedLabel?: string
}

function formatCountdown(diffMs: number): string {
  if (diffMs <= 0) return "0s"
  const totalSecs = Math.floor(diffMs / 1000)
  const days = Math.floor(totalSecs / 86400)
  const hours = Math.floor((totalSecs % 86400) / 3600)
  const minutes = Math.floor((totalSecs % 3600) / 60)
  const seconds = totalSecs % 60
  const parts: string[] = []
  if (days > 0) parts.push(`${days}d`)
  if (hours > 0) parts.push(`${hours}h`)
  if (minutes > 0) parts.push(`${minutes}m`)
  if (days === 0) parts.push(`${seconds}s`)
  return parts.join(" ")
}

export function CountdownTimer({ targetMs, label, endedLabel = "Ended" }: Props) {
  // Avoid hydration mismatch: Date.now() differs between server and client.
  // Start null on server, set on client mount.
  const [now, setNow] = useState<number | null>(null)

  useEffect(() => {
    const timeout = setTimeout(() => setNow(Date.now()), 0)
    const interval = setInterval(() => setNow(Date.now()), 1000)
    return () => {
      clearTimeout(timeout)
      clearInterval(interval)
    }
  }, [])

  if (now === null) {
    return <span className="text-[12px] text-[#64748b] dark:text-[#94a3b8] font-inter">&nbsp;</span>
  }

  const diff = targetMs - now

  if (diff <= 0) {
    return <span className="text-[12px] text-[#64748b] dark:text-[#94a3b8] font-inter">{endedLabel}</span>
  }

  return (
    <span className="text-[12px] text-[#64748b] dark:text-[#94a3b8] font-inter whitespace-nowrap">
      {label && `${label} `}
      {formatCountdown(diff)}
    </span>
  )
}
