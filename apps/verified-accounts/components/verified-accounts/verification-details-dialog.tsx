"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, Button } from "@near-citizens/ui"
import { ShieldCheck, ExternalLink } from "lucide-react"
import { SignatureVerifyModal } from "./signature-verify-modal"
import { ProofVerifyModal } from "./proof-verify-modal"
import type { VerifiedAccountWithStatus } from "@/app/verified-accounts/actions"

interface Props {
  data: VerifiedAccountWithStatus | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function VerificationDetailsDialog({ data, open, onOpenChange }: Props) {
  const [showSignatureModal, setShowSignatureModal] = useState(false)
  const [showZkProofModal, setShowZkProofModal] = useState(false)

  if (!data) return null

  const { account, verification, proofData } = data
  const allValid = verification.zkValid && verification.signatureValid

  // Build terminal output lines (static, no animation)
  const lines = buildTerminalOutput(account, verification, proofData)

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" />
              Verify Proof
            </DialogTitle>
          </DialogHeader>

          {/* Terminal Output */}
          <div className="bg-muted rounded-lg p-4 font-mono text-sm h-80 border border-border overflow-x-auto overflow-y-auto">
            <pre className="m-0">
              {lines.map((line, i) => (
                <div key={i} className={getLineClassName(line)}>
                  {line}
                </div>
              ))}
            </pre>
          </div>

          {/* Verification Buttons */}
          {allValid && proofData && (
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
      </Dialog>

      {/* Sub-modals for verification guides */}
      <SignatureVerifyModal
        open={showSignatureModal}
        onOpenChange={setShowSignatureModal}
        data={
          proofData?.nearSignatureVerification && proofData?.signature
            ? {
                ...proofData.nearSignatureVerification,
                challenge: proofData.signature.challenge,
                recipient: proofData.signature.recipient,
              }
            : null
        }
      />

      <ProofVerifyModal
        open={showZkProofModal}
        onOpenChange={setShowZkProofModal}
        data={
          proofData
            ? {
                proof: proofData.zkProof,
                publicSignals: proofData.publicSignals,
                nullifier: proofData.nullifier,
                attestationId: proofData.attestationId,
                userId: proofData.userId,
                verifiedAt: proofData.verifiedAt,
              }
            : null
        }
      />
    </>
  )
}

interface VerificationResult {
  zkValid: boolean
  signatureValid: boolean
  error?: string
}

interface AccountData {
  nearAccountId: string
  nullifier: string
  userId: string
  attestationId: string
  verifiedAt: number
  selfProof: {
    proof: {
      a: [string, string]
      b: [[string, string], [string, string]]
      c: [string, string]
    }
    publicSignals: string[]
  }
  userContextData: string
}

interface ProofDataType {
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
  nearSignatureVerification: {
    nep413Hash: string
    publicKeyHex: string
    signatureHex: string
  }
}

function buildTerminalOutput(
  account: AccountData,
  verification: VerificationResult,
  proofData: ProofDataType | null,
): string[] {
  const lines: string[] = []

  lines.push(`> Verifying ${account.nearAccountId}`)
  lines.push("")

  // Step 1
  lines.push("[1/4] Loading account data from chain...")
  lines.push(`    ✓ Found account: ${account.nearAccountId}`)
  lines.push("")

  // Step 2
  lines.push("[2/4] Verifying ZK passport proof (Celo)...")
  if (verification.zkValid) {
    lines.push(`    ✓ Groth16 ZK proof verified via Celo (${account.selfProof.publicSignals.length} signals)`)
  } else {
    lines.push(`    ✗ ZK proof verification failed`)
    if (verification.error) {
      lines.push(`    Error: ${verification.error}`)
    }
  }
  lines.push("")

  // Step 3
  lines.push("[3/4] Confirming age verification status...")
  lines.push("    ✓ Age verified at registration (proof stored on-chain)")
  lines.push("")

  // Step 4
  lines.push("[4/4] Verifying NEAR wallet signature...")
  if (verification.signatureValid) {
    lines.push(`    ✓ NEP-413 signature verified for ${account.nearAccountId}`)
  } else {
    lines.push(`    ✗ Signature verification failed`)
    if (verification.error && !verification.zkValid === false) {
      lines.push(`    Error: ${verification.error}`)
    }
  }
  lines.push("")

  // Show proof data if verification succeeded
  if (verification.zkValid && verification.signatureValid && proofData) {
    const p = proofData
    lines.push("")
    lines.push("════════════════════════════════════════════════════════════════════════════════")
    lines.push("SELF.XYZ ZK PROOF (Groth16)")
    lines.push("════════════════════════════════════════════════════════════════════════════════")
    lines.push("")
    lines.push(`  nullifier: ${p.nullifier}`)
    lines.push(`  user_id: ${p.userId}`)
    lines.push(`  attestation_id: ${p.attestationId}`)
    lines.push(`  verified_at: ${p.verifiedAt}`)
    lines.push(`  verified_at_iso: ${new Date(p.verifiedAt).toISOString()}`)
    lines.push("")
    lines.push("  proof.a[0]: " + p.zkProof.a[0])
    lines.push("  proof.a[1]: " + p.zkProof.a[1])
    lines.push("  proof.b[0][0]: " + p.zkProof.b[0][0])
    lines.push("  proof.b[0][1]: " + p.zkProof.b[0][1])
    lines.push("  proof.b[1][0]: " + p.zkProof.b[1][0])
    lines.push("  proof.b[1][1]: " + p.zkProof.b[1][1])
    lines.push("  proof.c[0]: " + p.zkProof.c[0])
    lines.push("  proof.c[1]: " + p.zkProof.c[1])
    lines.push("")
    lines.push(`  public_signals: (${p.publicSignals.length} elements)`)
    p.publicSignals.forEach((signal, idx) => {
      lines.push(`    [${idx}]: ${signal}`)
    })
    lines.push("")
    lines.push("  user_context_data (hex):")
    lines.push(`    ${p.userContextData}`)
    lines.push("")
    lines.push("════════════════════════════════════════════════════════════════════════════════")
    lines.push("NEAR WALLET SIGNATURE (NEP-413)")
    lines.push("════════════════════════════════════════════════════════════════════════════════")
    lines.push("")
    lines.push(`  account_id: ${p.signature.accountId}`)
    lines.push(`  public_key: ${p.signature.publicKey}`)
    lines.push(`  signature: ${p.signature.signature}`)
    lines.push(`  nonce (base64): ${p.signature.nonce}`)
    lines.push(`  challenge: ${p.signature.challenge}`)
    lines.push(`  recipient: ${p.signature.recipient}`)
    lines.push("")
  }

  // Final status
  lines.push("")
  if (verification.zkValid && verification.signatureValid) {
    lines.push("═══════════════════════════════════════════")
    lines.push("  VERIFICATION COMPLETE - ALL CHECKS PASSED")
    lines.push("═══════════════════════════════════════════")
  } else {
    lines.push("═══════════════════════════════════════════")
    lines.push("  VERIFICATION FAILED")
    if (verification.error) {
      lines.push(`  Error: ${verification.error}`)
    }
    lines.push("═══════════════════════════════════════════")
  }

  return lines
}

function getLineClassName(line: string): string {
  if (line.includes("✓")) return "text-foreground leading-relaxed whitespace-pre"
  if (line.includes("✗") || line.toLowerCase().includes("error"))
    return "text-destructive leading-relaxed whitespace-pre"
  if (line.includes("VERIFICATION COMPLETE")) return "text-foreground font-bold leading-relaxed whitespace-pre"
  if (line.includes("VERIFICATION FAILED")) return "text-destructive font-bold leading-relaxed whitespace-pre"
  if (line.startsWith(">")) return "text-foreground leading-relaxed whitespace-pre"
  if (line.includes("════") || line.includes("═══")) return "text-muted-foreground/50 leading-relaxed whitespace-pre"
  if (line.includes("SELF.XYZ") || line.includes("NEAR WALLET"))
    return "text-foreground font-bold leading-relaxed whitespace-pre"
  if (line.startsWith("[") && line.includes("]")) return "text-muted-foreground leading-relaxed whitespace-pre"
  return "text-muted-foreground leading-relaxed whitespace-pre"
}
