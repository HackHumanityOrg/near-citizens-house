"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { ShieldCheck, Copy, Check } from "lucide-react"

interface VerificationStep {
  name: string
  status: "pending" | "running" | "success" | "error"
  message?: string
}

interface ProofData {
  nullifier: string
  userId: string
  attestationId: string
  verifiedAt: number
  zkProof: {
    a: [string, string]
    b: [[string, string], [string, string]]
    c: [string, string]
  }
  publicSignals: string[]
  signature: {
    accountId: string
    publicKey: string
    signature: string
    nonce: string
    challenge: string
    recipient: string
  }
  userContextData: string
}

interface VerificationResponse {
  verified: boolean
  steps: VerificationStep[]
  nearAccountId?: string
  attestationId?: string
  error?: string
  proofData?: ProofData
}

interface VerificationModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  nearAccountId: string
  onVerificationComplete?: (result: VerificationResponse) => void
}

const STEP_DELAY = 400

export function VerificationModal({
  open,
  onOpenChange,
  nearAccountId,
  onVerificationComplete,
}: VerificationModalProps) {
  const [isComplete, setIsComplete] = useState(false)
  const [terminalLines, setTerminalLines] = useState<string[]>([])
  const [copied, setCopied] = useState(false)
  const terminalRef = useRef<HTMLDivElement>(null)
  const hasStartedRef = useRef(false)

  const addTerminalLine = useCallback((line: string) => {
    setTerminalLines((prev) => [...prev, line])
  }, [])

  const copyTerminalContent = useCallback(() => {
    const content = terminalLines.join("\n")
    navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [terminalLines])

  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      hasStartedRef.current = false
    }
  }, [open])

  // Start verification when modal opens
  useEffect(() => {
    if (!open || !nearAccountId || hasStartedRef.current) return

    hasStartedRef.current = true

    // Reset state
    setIsComplete(false)
    setTerminalLines([])
    setCopied(false)

    const runVerification = async () => {
      addTerminalLine(`> Verifying ${nearAccountId}`)
      addTerminalLine("")

      try {
        const response = await fetch("/api/verify-stored", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nearAccountId }),
        })

        const result: VerificationResponse = await response.json()

        // Animate through each step
        for (let i = 0; i < result.steps.length; i++) {
          const step = result.steps[i]

          addTerminalLine(`[${i + 1}/${result.steps.length}] ${step.name}...`)

          await new Promise((r) => setTimeout(r, STEP_DELAY))

          if (step.status === "success") {
            addTerminalLine(`    ✓ ${step.message || "OK"}`)
          } else if (step.status === "error") {
            addTerminalLine(`    ✗ ${step.message || "Failed"}`)
            break
          }

          addTerminalLine("")
          await new Promise((r) => setTimeout(r, 200))
        }

        // Show proof data if verification succeeded
        if (result.verified && result.proofData) {
          const p = result.proofData
          addTerminalLine("")
          addTerminalLine("════════════════════════════════════════════════════════════════════════════════")
          addTerminalLine("SELF.XYZ ZK PROOF (Groth16)")
          addTerminalLine("════════════════════════════════════════════════════════════════════════════════")
          addTerminalLine("")
          addTerminalLine(`  nullifier: ${p.nullifier}`)
          addTerminalLine(`  user_id: ${p.userId}`)
          addTerminalLine(`  attestation_id: ${p.attestationId}`)
          addTerminalLine(`  verified_at: ${p.verifiedAt}`)
          addTerminalLine(`  verified_at_iso: ${new Date(p.verifiedAt).toISOString()}`)
          addTerminalLine("")
          addTerminalLine("  proof.a[0]: " + p.zkProof.a[0])
          addTerminalLine("  proof.a[1]: " + p.zkProof.a[1])
          addTerminalLine("  proof.b[0][0]: " + p.zkProof.b[0][0])
          addTerminalLine("  proof.b[0][1]: " + p.zkProof.b[0][1])
          addTerminalLine("  proof.b[1][0]: " + p.zkProof.b[1][0])
          addTerminalLine("  proof.b[1][1]: " + p.zkProof.b[1][1])
          addTerminalLine("  proof.c[0]: " + p.zkProof.c[0])
          addTerminalLine("  proof.c[1]: " + p.zkProof.c[1])
          addTerminalLine("")
          addTerminalLine(`  public_signals: (${p.publicSignals.length} elements)`)
          p.publicSignals.forEach((signal, idx) => {
            addTerminalLine(`    [${idx}]: ${signal}`)
          })
          addTerminalLine("")
          addTerminalLine("  user_context_data (hex):")
          addTerminalLine(`    ${p.userContextData}`)
          addTerminalLine("")
          addTerminalLine("════════════════════════════════════════════════════════════════════════════════")
          addTerminalLine("NEAR WALLET SIGNATURE (NEP-413)")
          addTerminalLine("════════════════════════════════════════════════════════════════════════════════")
          addTerminalLine("")
          addTerminalLine(`  account_id: ${p.signature.accountId}`)
          addTerminalLine(`  public_key: ${p.signature.publicKey}`)
          addTerminalLine(`  signature: ${p.signature.signature}`)
          addTerminalLine(`  nonce (base64): ${p.signature.nonce}`)
          addTerminalLine(`  challenge: ${p.signature.challenge}`)
          addTerminalLine(`  recipient: ${p.signature.recipient}`)
          addTerminalLine("")
        }

        addTerminalLine("")
        if (result.verified) {
          addTerminalLine("═══════════════════════════════════════════")
          addTerminalLine("  VERIFICATION COMPLETE - ALL CHECKS PASSED")
          addTerminalLine("═══════════════════════════════════════════")
        } else {
          addTerminalLine("═══════════════════════════════════════════")
          addTerminalLine("  VERIFICATION FAILED")
          if (result.error) {
            addTerminalLine(`  Error: ${result.error}`)
          }
          addTerminalLine("═══════════════════════════════════════════")
        }

        setIsComplete(true)
        onVerificationComplete?.(result)
      } catch (error) {
        addTerminalLine("")
        addTerminalLine(`Error: ${error instanceof Error ? error.message : "Connection failed"}`)
        setIsComplete(true)
      }
    }

    runVerification()
  }, [open, nearAccountId, onVerificationComplete, addTerminalLine])

  // Auto-scroll terminal
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight
    }
  }, [terminalLines])

  const renderTerminalLine = (line: string, index: number) => {
    let className = "text-gray-300" // default for data

    if (line.includes("✓")) {
      className = "text-green-400"
    } else if (line.includes("✗") || line.toLowerCase().includes("error")) {
      className = "text-red-400"
    } else if (line.includes("VERIFICATION COMPLETE")) {
      className = "text-green-400 font-bold"
    } else if (line.includes("VERIFICATION FAILED")) {
      className = "text-red-400 font-bold"
    } else if (line.startsWith(">")) {
      className = "text-blue-400"
    } else if (line.includes("════") || line.includes("═══")) {
      className = "text-gray-500"
    } else if (line.includes("SELF.XYZ") || line.includes("NEAR WALLET")) {
      className = "text-white font-bold"
    } else if (line.startsWith("[") && line.includes("]")) {
      className = "text-gray-400"
    }

    return (
      <div key={index} className={`leading-relaxed whitespace-pre ${className}`}>
        {line}
        {index === terminalLines.length - 1 && !isComplete && (
          <span className="inline-block w-2 h-4 bg-green-400 ml-1 animate-pulse" />
        )}
      </div>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl overflow-hidden" showCloseButton={isComplete}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            Verify Proof
          </DialogTitle>
        </DialogHeader>

        {/* Terminal Output */}
        <div className="relative min-w-0">
          <div
            ref={terminalRef}
            className="bg-black rounded-lg p-4 font-mono text-sm text-green-400 h-80 border border-green-900/50 overflow-x-auto overflow-y-auto"
          >
            <pre className="m-0">
              {terminalLines.map((line, i) => renderTerminalLine(line, i))}
              {terminalLines.length === 0 && <span className="inline-block w-2 h-4 bg-green-400 animate-pulse" />}
            </pre>
          </div>

          {/* Copy Button */}
          {isComplete && (
            <Button
              variant="ghost"
              size="sm"
              className="absolute top-2 right-6 h-8 w-8 p-0 bg-black/50 hover:bg-black/80 text-gray-400 hover:text-gray-200"
              onClick={copyTerminalContent}
              title="Copy terminal output"
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
