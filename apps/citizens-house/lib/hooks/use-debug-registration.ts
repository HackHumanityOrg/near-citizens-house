"use client"

import { useEffect, useCallback } from "react"
import { useDebugContext, type DebugComponentRegistration } from "../providers/debug-provider"

interface UseDebugRegistrationOptions {
  id: string
  name: string
  availableStates: string[]
  currentState: string
  onStateChange: (state: string) => void
  additionalControls?: { label: string; action: () => void }[]
}

export function useDebugRegistration({
  id,
  name,
  availableStates,
  currentState,
  onStateChange,
  additionalControls,
}: UseDebugRegistrationOptions) {
  const { isDebugEnabled, registerComponent, unregisterComponent, updateComponentState } = useDebugContext()

  // Memoize the setState callback to prevent unnecessary re-registrations
  const setState = useCallback(
    (state: string) => {
      onStateChange(state)
    },
    [onStateChange],
  )

  // Register component on mount, unregister on unmount
  useEffect(() => {
    if (!isDebugEnabled) return

    const registration: DebugComponentRegistration = {
      name,
      currentState,
      availableStates,
      setState,
      additionalControls,
    }

    registerComponent(id, registration)

    return () => {
      unregisterComponent(id)
    }
  }, [
    isDebugEnabled,
    id,
    name,
    availableStates,
    setState,
    additionalControls,
    registerComponent,
    unregisterComponent,
    currentState,
  ])

  // Update current state in context when it changes
  useEffect(() => {
    if (!isDebugEnabled) return
    updateComponentState(id, currentState)
  }, [isDebugEnabled, id, currentState, updateComponentState])

  return { isDebugEnabled }
}
