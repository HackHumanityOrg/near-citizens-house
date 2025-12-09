"use client"

import { useSyncExternalStore, useCallback } from "react"

interface CountdownTimerProps {
  endTime: number // milliseconds
  className?: string
}

function formatTimeLeft(endTime: number): string {
  const now = Date.now()
  const diff = endTime - now

  if (diff <= 0) {
    return "Voting ended"
  }

  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))

  if (days > 0) {
    return `${days}d ${hours}h remaining`
  } else if (hours > 0) {
    return `${hours}h ${minutes}m remaining`
  } else {
    return `${minutes}m remaining`
  }
}

// Custom hook using useSyncExternalStore for time-based updates
// This is the React-idiomatic way to subscribe to external time source
function useCountdown(endTime: number): string {
  const subscribe = useCallback(
    (callback: () => void) => {
      // Update every minute
      const interval = setInterval(callback, 60000)
      return () => clearInterval(interval)
    },
    [], // No deps needed - interval logic doesn't depend on endTime
  )

  const getSnapshot = useCallback(() => formatTimeLeft(endTime), [endTime])

  // Server snapshot returns initial calculation
  const getServerSnapshot = useCallback(() => formatTimeLeft(endTime), [endTime])

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

export function CountdownTimer({ endTime, className = "" }: CountdownTimerProps) {
  const timeLeft = useCountdown(endTime)

  return <div className={`text-sm text-muted-foreground ${className}`}>{timeLeft}</div>
}
