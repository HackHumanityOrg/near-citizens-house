"use client"

import { useEffect, useState } from "react"

interface CountdownTimerProps {
  endTime: number // milliseconds
  className?: string
}

export function CountdownTimer({ endTime, className = "" }: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState<string>("")

  useEffect(() => {
    const calculateTimeLeft = () => {
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

    // Initial calculation
    setTimeLeft(calculateTimeLeft())

    // Update every minute
    const interval = setInterval(() => {
      setTimeLeft(calculateTimeLeft())
    }, 60000)

    return () => clearInterval(interval)
  }, [endTime])

  return <div className={`text-sm text-muted-foreground ${className}`}>{timeLeft}</div>
}
