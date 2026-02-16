import { cn } from "./utils"

interface SkeletonProps {
  className?: string
}

export function Skeleton({ className }: SkeletonProps) {
  return <div aria-hidden className={cn("animate-pulse rounded bg-[#e2e8f0] dark:bg-white/10", className)} />
}
