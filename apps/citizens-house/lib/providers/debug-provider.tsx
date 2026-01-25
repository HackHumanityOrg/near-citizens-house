"use client"

import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from "react"

export interface DebugComponentRegistration {
  name: string
  currentState: string
  availableStates: string[]
  setState: (state: string) => void
  additionalControls?: { label: string; action: () => void }[]
}

interface DebugContextType {
  isDebugEnabled: boolean
  isDebugPanelOpen: boolean
  setDebugPanelOpen: (open: boolean) => void
  registeredComponents: Map<string, DebugComponentRegistration>
  registerComponent: (id: string, registration: DebugComponentRegistration) => void
  unregisterComponent: (id: string) => void
  updateComponentState: (id: string, state: string) => void
}

const DebugContext = createContext<DebugContextType | null>(null)

export function useDebugContext() {
  const context = useContext(DebugContext)
  if (!context) {
    // Return a no-op context when debug is disabled
    return {
      isDebugEnabled: false,
      isDebugPanelOpen: false,
      setDebugPanelOpen: () => {},
      registeredComponents: new Map(),
      registerComponent: () => {},
      unregisterComponent: () => {},
      updateComponentState: () => {},
    }
  }
  return context
}

interface DebugProviderProps {
  children: ReactNode
}

// Helper to check debug param on client
function getInitialDebugState(): { enabled: boolean; open: boolean } {
  if (typeof window === "undefined") {
    return { enabled: false, open: false }
  }
  const urlParams = new URLSearchParams(window.location.search)
  const debugParam = urlParams.get("debug")
  if (debugParam === "1") {
    return { enabled: true, open: true }
  }
  return { enabled: false, open: false }
}

export function DebugProvider({ children }: DebugProviderProps) {
  const [isDebugEnabled, setIsDebugEnabled] = useState(() => getInitialDebugState().enabled)
  const [isDebugPanelOpen, setDebugPanelOpen] = useState(() => getInitialDebugState().open)
  const [registeredComponents, setRegisteredComponents] = useState<Map<string, DebugComponentRegistration>>(new Map())

  // Key sequence tracking for Ctrl+Shift+D x3
  const keyPressTimestamps = useRef<number[]>([])
  const KEY_SEQUENCE_TIMEOUT = 2000 // 2 seconds
  const REQUIRED_PRESSES = 3

  // Key sequence handler for Ctrl+Shift+D x3
  useEffect(() => {
    if (typeof window === "undefined") return

    const handleKeyDown = (e: KeyboardEvent) => {
      // Check for Ctrl+Shift+D (or Cmd+Shift+D on Mac)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "d") {
        e.preventDefault()

        const now = Date.now()

        // Filter out old timestamps
        keyPressTimestamps.current = keyPressTimestamps.current.filter(
          (timestamp) => now - timestamp < KEY_SEQUENCE_TIMEOUT,
        )

        // Add current timestamp
        keyPressTimestamps.current.push(now)

        // Check if we have enough presses
        if (keyPressTimestamps.current.length >= REQUIRED_PRESSES) {
          setIsDebugEnabled(true)
          setDebugPanelOpen(true)
          keyPressTimestamps.current = []
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  const registerComponent = useCallback((id: string, registration: DebugComponentRegistration) => {
    setRegisteredComponents((prev) => {
      const next = new Map(prev)
      next.set(id, registration)
      return next
    })
  }, [])

  const unregisterComponent = useCallback((id: string) => {
    setRegisteredComponents((prev) => {
      const next = new Map(prev)
      next.delete(id)
      return next
    })
  }, [])

  const updateComponentState = useCallback((id: string, state: string) => {
    setRegisteredComponents((prev) => {
      const component = prev.get(id)
      if (!component) return prev

      const next = new Map(prev)
      next.set(id, { ...component, currentState: state })
      return next
    })
  }, [])

  return (
    <DebugContext.Provider
      value={{
        isDebugEnabled,
        isDebugPanelOpen,
        setDebugPanelOpen,
        registeredComponents,
        registerComponent,
        unregisterComponent,
        updateComponentState,
      }}
    >
      {children}
    </DebugContext.Provider>
  )
}
