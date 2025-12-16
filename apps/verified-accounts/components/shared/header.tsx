import Image from "next/image"
import Link from "next/link"
import { ThemeToggle } from "@near-citizens/ui"

export function Header() {
  return (
    <header className="border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
      <div className="container mx-auto px-4 max-w-7xl">
        <div className="flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center">
            <Image src="/logo.svg" alt="NEAR Citizens House" width={280} height={33} className="dark:invert" />
          </Link>
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}
