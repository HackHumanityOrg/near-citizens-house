"use client"

import { useMemo } from "react"
import * as jdenticon from "jdenticon"

interface IdenticonProps {
  value: string
  size?: number
  className?: string
}

export function Identicon({ value, size = 48, className }: IdenticonProps) {
  const svg = useMemo(() => {
    return jdenticon.toSvg(value, size)
  }, [value, size])

  return (
    <div
      className={className}
      style={{ width: size, height: size, borderRadius: "50%", overflow: "hidden" }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}
