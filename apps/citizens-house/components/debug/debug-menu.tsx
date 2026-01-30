"use client"

import { useState, useEffect, useCallback } from "react"
import { X, ChevronDown, ChevronRight, Bug, GripVertical } from "lucide-react"
import { useDebugContext } from "@/lib/providers/debug-provider"
import { ERROR_CATEGORIES, type VerificationErrorCode } from "@/lib/schemas"

interface CollapsibleSectionProps {
  title: string
  children: React.ReactNode
  defaultOpen?: boolean
}

function CollapsibleSection({ title, children, defaultOpen = true }: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <div className="border-b border-[#333] last:border-b-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-[#2a2a2a] transition-colors"
      >
        {isOpen ? <ChevronDown className="w-4 h-4 text-[#888]" /> : <ChevronRight className="w-4 h-4 text-[#888]" />}
        <span className="text-xs font-semibold text-[#aaa] uppercase tracking-wider">{title}</span>
      </button>
      {isOpen && <div className="px-3 pb-3">{children}</div>}
    </div>
  )
}

// Helper to format error code for display
function formatErrorCode(code: string): string {
  return code.replace(/_/g, " ")
}

interface StateButtonProps {
  state: string
  isActive: boolean
  onClick: () => void
}

function StateButton({ state, isActive, onClick }: StateButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`px-2 py-1 text-xs rounded font-mono transition-colors ${
        isActive ? "bg-[#ffda1e] text-black font-semibold" : "bg-[#333] text-[#ccc] hover:bg-[#444] hover:text-white"
      }`}
    >
      {state}
    </button>
  )
}

// Helper to get initial position from bottom-right
function getInitialPosition(): { x: number; y: number } {
  if (typeof window === "undefined") {
    return { x: 16, y: 16 }
  }
  return {
    x: window.innerWidth - 380,
    y: window.innerHeight - 500,
  }
}

export function DebugMenu() {
  const { isDebugEnabled, isDebugPanelOpen, setDebugPanelOpen, registeredComponents } = useDebugContext()
  const [position, setPosition] = useState(getInitialPosition)
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })

  // Dispatch error trigger events
  const triggerRetryableError = useCallback((code: VerificationErrorCode) => {
    window.dispatchEvent(
      new CustomEvent("debug:trigger-error", {
        detail: { type: "retryable", code },
      }),
    )
  }, [])

  const triggerHoldError = useCallback((code: VerificationErrorCode) => {
    window.dispatchEvent(
      new CustomEvent("debug:trigger-error", {
        detail: { type: "hold", code },
      }),
    )
  }, [])

  const triggerNonRetryableError = useCallback((code: VerificationErrorCode) => {
    window.dispatchEvent(
      new CustomEvent("debug:trigger-error", {
        detail: { type: "non-retryable", code },
      }),
    )
  }, [])

  const clearErrors = useCallback(() => {
    window.dispatchEvent(new CustomEvent("debug:clear-errors"))
  }, [])

  // Dragging logic
  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: MouseEvent) => {
      setPosition({
        x: e.clientX - dragOffset.x,
        y: e.clientY - dragOffset.y,
      })
    }

    const handleMouseUp = () => {
      setIsDragging(false)
    }

    window.addEventListener("mousemove", handleMouseMove)
    window.addEventListener("mouseup", handleMouseUp)

    return () => {
      window.removeEventListener("mousemove", handleMouseMove)
      window.removeEventListener("mouseup", handleMouseUp)
    }
  }, [isDragging, dragOffset])

  const handleDragStart = (e: React.MouseEvent) => {
    setIsDragging(true)
    setDragOffset({
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    })
  }

  if (!isDebugEnabled) return null

  // Floating trigger button when panel is closed
  if (!isDebugPanelOpen) {
    return (
      <button
        onClick={() => setDebugPanelOpen(true)}
        className="fixed bottom-4 right-4 z-[9999] bg-[#1a1a1a] border border-[#333] rounded-full p-3 shadow-lg hover:bg-[#2a2a2a] transition-colors"
        title="Open Debug Menu (Ctrl+Shift+D x3)"
      >
        <Bug className="w-5 h-5 text-[#ffda1e]" />
      </button>
    )
  }

  return (
    <div
      className="fixed z-[9999] bg-[#1a1a1a] border border-[#333] rounded-lg shadow-2xl w-[360px] max-h-[80vh] overflow-hidden flex flex-col font-mono text-sm"
      style={{
        left: position.x,
        top: position.y,
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-2 bg-[#222] border-b border-[#333] cursor-move select-none"
        onMouseDown={handleDragStart}
      >
        <div className="flex items-center gap-2">
          <GripVertical className="w-4 h-4 text-[#555]" />
          <Bug className="w-4 h-4 text-[#ffda1e]" />
          <span className="text-xs font-bold text-[#ffda1e] uppercase tracking-wider">Debug Menu</span>
        </div>
        <button onClick={() => setDebugPanelOpen(false)} className="p-1 hover:bg-[#333] rounded transition-colors">
          <X className="w-4 h-4 text-[#888]" />
        </button>
      </div>

      {/* Content */}
      <div className="overflow-y-auto flex-1">
        {/* Registered Components */}
        {Array.from(registeredComponents.entries()).map(([id, component]) => {
          // Skip error-modal in the regular list - we handle it specially
          if (id === "error-modal") return null

          return (
            <CollapsibleSection key={id} title={component.name}>
              <div className="flex flex-wrap gap-1.5">
                {component.availableStates.map((state: string) => (
                  <StateButton
                    key={state}
                    state={state}
                    isActive={component.currentState === state}
                    onClick={() => component.setState(state)}
                  />
                ))}
              </div>
              {component.additionalControls && component.additionalControls.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2 pt-2 border-t border-[#333]">
                  {component.additionalControls.map((control: { label: string; action: () => void }) => (
                    <button
                      key={control.label}
                      onClick={control.action}
                      className="px-2 py-1 text-xs rounded bg-[#2a4a2a] text-[#8f8] hover:bg-[#3a5a3a] transition-colors"
                    >
                      {control.label}
                    </button>
                  ))}
                </div>
              )}
            </CollapsibleSection>
          )
        })}

        {/* Error Testing Section */}
        <CollapsibleSection title="Error Testing">
          <div className="space-y-3">
            {/* Derive error lists from exhaustive ERROR_CATEGORIES */}
            {(
              [
                {
                  category: "retryable",
                  label: "Retryable → Modal:",
                  labelColor: "text-[#fa8]",
                  btnBg: "bg-[#3a3a2a]",
                  btnText: "text-[#fa8]",
                  btnHover: "hover:bg-[#4a4a3a]",
                  trigger: triggerRetryableError,
                },
                {
                  category: "hold",
                  label: "Hold → Hold Step:",
                  labelColor: "text-[#ffda1e]",
                  btnBg: "bg-[#3a3a1a]",
                  btnText: "text-[#ffda1e]",
                  btnHover: "hover:bg-[#4a4a2a]",
                  trigger: triggerHoldError,
                },
                {
                  category: "non-retryable",
                  label: "Non-Retryable → Error Step:",
                  labelColor: "text-[#f88]",
                  btnBg: "bg-[#4a2a2a]",
                  btnText: "text-[#f88]",
                  btnHover: "hover:bg-[#5a3a3a]",
                  trigger: triggerNonRetryableError,
                },
                {
                  category: "internal",
                  label: "Internal → Error Step:",
                  labelColor: "text-[#88f]",
                  btnBg: "bg-[#2a2a4a]",
                  btnText: "text-[#88f]",
                  btnHover: "hover:bg-[#3a3a5a]",
                  trigger: triggerNonRetryableError,
                },
              ] as const
            ).map(({ category, label, labelColor, btnBg, btnText, btnHover, trigger }) => {
              const codes = (Object.keys(ERROR_CATEGORIES) as VerificationErrorCode[]).filter(
                (code) => ERROR_CATEGORIES[code] === category,
              )
              if (codes.length === 0) return null
              return (
                <div key={category} className="space-y-1.5">
                  <span className={`text-xs ${labelColor}`}>{label}</span>
                  <div className="flex flex-wrap gap-1.5">
                    {codes.map((code) => (
                      <button
                        key={code}
                        onClick={() => trigger(code)}
                        className={`px-2 py-1 text-xs rounded ${btnBg} ${btnText} ${btnHover} transition-colors`}
                      >
                        {formatErrorCode(code)}
                      </button>
                    ))}
                  </div>
                </div>
              )
            })}

            {/* Clear Errors */}
            <button
              onClick={clearErrors}
              className="w-full px-3 py-1.5 text-xs rounded bg-[#333] text-[#ccc] hover:bg-[#444] transition-colors"
            >
              Clear Errors
            </button>
          </div>
        </CollapsibleSection>

        {/* Help Section */}
        <CollapsibleSection title="Keyboard Shortcuts" defaultOpen={false}>
          <div className="text-xs text-[#888] space-y-1">
            <p>
              <kbd className="px-1 py-0.5 bg-[#333] rounded text-[#ccc]">Ctrl+Shift+D</kbd> x3 - Toggle debug mode
            </p>
            <p>
              <kbd className="px-1 py-0.5 bg-[#333] rounded text-[#ccc]">?debug=1</kbd> - Enable via URL
            </p>
          </div>
        </CollapsibleSection>
      </div>

      {/* Footer */}
      <div className="px-3 py-2 bg-[#222] border-t border-[#333] text-xs text-[#666]">
        {registeredComponents.size} component{registeredComponents.size !== 1 ? "s" : ""} registered
      </div>
    </div>
  )
}
