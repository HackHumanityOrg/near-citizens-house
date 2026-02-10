"use client"

import { createContext, useContext, useState, useEffect, useRef, type ReactNode } from "react"

interface DebugContextType {
  isDebugEnabled: boolean
  isDebugPanelOpen: boolean
  setDebugPanelOpen: (open: boolean) => void
}

const noop = () => {}
const defaultContext: DebugContextType = {
  isDebugEnabled: false,
  isDebugPanelOpen: false,
  setDebugPanelOpen: noop,
}

const DebugContext = createContext<DebugContextType>(defaultContext)

export function useDebugContext() {
  return useContext(DebugContext)
}

function getInitialDebugState(): { enabled: boolean; open: boolean } {
  if (process.env.NODE_ENV === "production" && process.env.NEXT_PUBLIC_VERCEL_ENV !== "preview")
    return { enabled: false, open: false }
  if (typeof window === "undefined") return { enabled: false, open: false }
  const params = new URLSearchParams(window.location.search)
  if (params.get("debug") === "1") return { enabled: true, open: true }
  return { enabled: false, open: false }
}

export function DebugProvider({ children }: { children: ReactNode }) {
  const [isDebugEnabled, setIsDebugEnabled] = useState(() => getInitialDebugState().enabled)
  const [isDebugPanelOpen, setDebugPanelOpen] = useState(() => getInitialDebugState().open)

  const keyTimestamps = useRef<number[]>([])

  useEffect(() => {
    if (process.env.NODE_ENV === "production" && process.env.NEXT_PUBLIC_VERCEL_ENV !== "preview") return

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "d") {
        e.preventDefault()
        const now = Date.now()
        keyTimestamps.current = keyTimestamps.current.filter((t) => now - t < 2000)
        keyTimestamps.current.push(now)
        if (keyTimestamps.current.length >= 3) {
          setIsDebugEnabled(true)
          setDebugPanelOpen(true)
          keyTimestamps.current = []
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  return (
    <DebugContext.Provider value={{ isDebugEnabled, isDebugPanelOpen, setDebugPanelOpen }}>
      {children}
    </DebugContext.Provider>
  )
}
