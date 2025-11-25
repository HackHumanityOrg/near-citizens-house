"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { ShieldCheck, Copy, Check, ExternalLink } from "lucide-react"
import { NearSignatureVerifyModal } from "./near-signature-verify-modal"
import { ZkProofVerifyModal } from "./zk-proof-verify-modal"

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
  nearSignatureVerification?: {
    nep413Hash: string
    publicKeyHex: string
    signatureHex: string
  }
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

export function VerificationModal({
  open,
  onOpenChange,
  nearAccountId,
  onVerificationComplete,
}: VerificationModalProps) {
  const [isComplete, setIsComplete] = useState(false)
  const [terminalLines, setTerminalLines] = useState<string[]>([])
  const [copied, setCopied] = useState(false)
  const [verificationResult, setVerificationResult] = useState<VerificationResponse | null>(null)
  const [showSignatureModal, setShowSignatureModal] = useState(false)
  const [showZkProofModal, setShowZkProofModal] = useState(false)
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
    setVerificationResult(null)
    setShowSignatureModal(false)
    setShowZkProofModal(false)

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

        // Display each step
        for (let i = 0; i < result.steps.length; i++) {
          const step = result.steps[i]

          addTerminalLine(`[${i + 1}/${result.steps.length}] ${step.name}...`)

          if (step.status === "success") {
            addTerminalLine(`    ✓ ${step.message || "OK"}`)
          } else if (step.status === "error") {
            addTerminalLine(`    ✗ ${step.message || "Failed"}`)
            break
          }

          addTerminalLine("")
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
        setVerificationResult(result)
        onVerificationComplete?.(result)
      } catch (error) {
        addTerminalLine("")
        addTerminalLine(`Error: ${error instanceof Error ? error.message : "Connection failed"}`)
        setIsComplete(true)
        setVerificationResult(null)
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
    let className = "text-muted-foreground"

    if (line.includes("✓")) {
      className = "text-foreground"
    } else if (line.includes("✗") || line.toLowerCase().includes("error")) {
      className = "text-destructive"
    } else if (line.includes("VERIFICATION COMPLETE")) {
      className = "text-foreground font-bold"
    } else if (line.includes("VERIFICATION FAILED")) {
      className = "text-destructive font-bold"
    } else if (line.startsWith(">")) {
      className = "text-foreground"
    } else if (line.includes("════") || line.includes("═══")) {
      className = "text-muted-foreground/50"
    } else if (line.includes("SELF.XYZ") || line.includes("NEAR WALLET")) {
      className = "text-foreground font-bold"
    } else if (line.startsWith("[") && line.includes("]")) {
      className = "text-muted-foreground"
    }

    return (
      <div key={index} className={`leading-relaxed whitespace-pre ${className}`}>
        {line}
        {index === terminalLines.length - 1 && !isComplete && (
          <span className="inline-block w-2 h-4 bg-foreground ml-1 animate-pulse" />
        )}
      </div>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl overflow-hidden">
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
            className="bg-muted rounded-lg p-4 font-mono text-sm text-foreground h-80 border border-border overflow-x-auto overflow-y-auto"
          >
            <pre className="m-0">
              {terminalLines.map((line, i) => renderTerminalLine(line, i))}
              {terminalLines.length === 0 && <span className="inline-block w-2 h-4 bg-foreground animate-pulse" />}
            </pre>
          </div>

          {/* Copy Button */}
          {isComplete && (
            <Button
              variant="ghost"
              size="sm"
              className="absolute top-2 right-6 h-8 w-8 p-0"
              onClick={copyTerminalContent}
              title="Copy terminal output"
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          )}
        </div>

        {/* Verification Buttons */}
        {isComplete && verificationResult?.verified && verificationResult.proofData && (
          <div className="space-y-2 mt-2">
            <p className="text-xs text-muted-foreground">Verify independently with third-party tools</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1" onClick={() => setShowSignatureModal(true)}>
                <ExternalLink className="h-4 w-4 mr-2" />
                NEAR Signature
              </Button>
              <Button variant="outline" size="sm" className="flex-1" onClick={() => setShowZkProofModal(true)}>
                <ExternalLink className="h-4 w-4 mr-2" />
                ZK Proof
              </Button>
            </div>
          </div>
        )}
      </DialogContent>

      {/* Sub-modals for verification guides */}
      <NearSignatureVerifyModal
        open={showSignatureModal}
        onOpenChange={setShowSignatureModal}
        data={
          verificationResult?.proofData?.nearSignatureVerification && verificationResult?.proofData?.signature
            ? {
                ...verificationResult.proofData.nearSignatureVerification,
                challenge: verificationResult.proofData.signature.challenge,
                recipient: verificationResult.proofData.signature.recipient,
              }
            : null
        }
      />

      <ZkProofVerifyModal
        open={showZkProofModal}
        onOpenChange={setShowZkProofModal}
        data={
          verificationResult?.proofData
            ? {
                proof: verificationResult.proofData.zkProof,
                publicSignals: verificationResult.proofData.publicSignals,
                nullifier: verificationResult.proofData.nullifier,
                attestationId: verificationResult.proofData.attestationId,
                userId: verificationResult.proofData.userId,
                verifiedAt: verificationResult.proofData.verifiedAt,
              }
            : null
        }
      />
    </Dialog>
  )
}
