"use client"

import { User } from "lucide-react"

interface IdenticonProps {
  value: string
  size?: number
  className?: string
}

export function Identicon({ size = 48, className }: IdenticonProps) {
  // Icon size is roughly 60% of the container for good proportions
  const iconSize = Math.round(size * 0.6)

  return (
    <div
      className={`flex items-center justify-center rounded-full bg-[#FFDA1E] ${className || ""}`}
      style={{ width: size, height: size }}
    >
      <User size={iconSize} className="text-black" strokeWidth={1.5} />
    </div>
  )
}
