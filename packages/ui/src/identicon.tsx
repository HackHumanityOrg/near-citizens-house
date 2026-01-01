"use client"

import Avatar from "boring-avatars"

interface IdenticonProps {
  value: string
  size?: number
  className?: string
}

const AVATAR_COLORS = ["#e6626f", "#efae78", "#f5e19c", "#a2ca8e", "#66af91"]

export function Identicon({ value, size = 48, className }: IdenticonProps) {
  return (
    <div className={className} style={{ width: size, height: size }}>
      <Avatar name={value} size={size} variant="marble" colors={AVATAR_COLORS} />
    </div>
  )
}
