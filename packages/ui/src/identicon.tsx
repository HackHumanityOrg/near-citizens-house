"use client"

import Avatar from "boring-avatars"

interface IdenticonProps {
  value: string
  size?: number
  className?: string
}

// Colors based on accent yellow with opacity (#FFDA1EE5 = 90% opacity)
const AVATAR_COLORS = ["#FFDA1EE5", "#FFDA1ECC", "#FFDA1EB3", "#FFDA1E99", "#FFDA1E80"]

export function Identicon({ value, size = 48, className }: IdenticonProps) {
  return (
    <div className={className} style={{ width: size, height: size }}>
      <Avatar name={value} size={size} variant="marble" colors={AVATAR_COLORS} />
    </div>
  )
}
