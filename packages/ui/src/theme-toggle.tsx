"use client"

import { useSyncExternalStore } from "react"
import { useTheme } from "next-themes"
import { Moon, Sun } from "lucide-react"

const emptySubscribe = () => () => {}
const getClientSnapshot = () => true
const getServerSnapshot = () => false

function useHydrated() {
  return useSyncExternalStore(emptySubscribe, getClientSnapshot, getServerSnapshot)
}

export function ThemeToggle() {
  const hydrated = useHydrated()
  const { resolvedTheme, setTheme } = useTheme()

  if (!hydrated) {
    return (
      <button
        type="button"
        className="text-foreground cursor-pointer hover:opacity-70 transition-opacity"
        aria-label="Toggle theme"
      >
        <Sun className="h-6 w-6" />
      </button>
    )
  }

  return (
    <button
      type="button"
      className="text-foreground cursor-pointer hover:opacity-70 transition-opacity"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      aria-label={`Switch to ${resolvedTheme === "dark" ? "light" : "dark"} mode`}
    >
      {resolvedTheme === "dark" ? <Sun className="h-6 w-6" /> : <Moon className="h-6 w-6" />}
    </button>
  )
}
