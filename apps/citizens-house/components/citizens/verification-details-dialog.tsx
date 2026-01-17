"use client"

import { useState } from "react"
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle } from "@near-citizens/ui"
import { getAttestationTypeName } from "@/lib"
import { ShieldCheck, ExternalLink } from "lucide-react"
import { SignatureVerifyModal } from "./signature-verify-modal"
import { ProofVerifyModal } from "./proof-verify-modal"
import type { VerificationWithStatus } from "@/app/citizens/actions"
import type { AttestationId, NearAccountId } from "@/lib/schemas"

interface Props {
  data: VerificationWithStatus | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function VerificationDetailsDialog({ data, open, onOpenChange }: Props) {
  const [showSignatureModal, setShowSignatureModal] = useState(false)
  const [showZkProofModal, setShowZkProofModal] = useState(false)

  if (!data) return null

  const handleOpenSignatureModal = () => {
    setShowSignatureModal(true)
  }

  const handleOpenZkProofModal = () => {
    setShowZkProofModal(true)
  }

  const { account, verification, proofData } = data
  const allValid = verification.zkValid && verification.signatureValid

  // Build terminal output lines (static, no animation)
  const lines = buildTerminalOutput(account, verification, proofData)

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-2xl bg-background dark:bg-black dark:border dark:border-white/20 rounded-[8px] border-none shadow-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[22px] leading-[28px] text-foreground font-fk-grotesk font-medium">
              <ShieldCheck className="h-5 w-5 text-[#ffda1e]" />
              Verify Proof
            </DialogTitle>
          </DialogHeader>

          {/* Terminal Output */}
          <div className="bg-[#1c1c1c] dark:bg-black/50 rounded-[12px] p-4 font-mono text-sm h-80 border border-[#333] dark:border-white/20 overflow-x-auto overflow-y-auto">
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
            <div className="space-y-3 mt-2">
              <p className="text-[12px] leading-[1.4] text-muted-foreground font-inter font-normal">
                Verify independently with third-party tools
              </p>
              <div className="flex gap-3">
                <Button
                  variant="citizens-outline"
                  size="citizens-xl"
                  className="flex-1"
                  onClick={handleOpenSignatureModal}
                >
                  <ExternalLink className="h-4 w-4" />
                  NEAR Signature
                </Button>
                <Button
                  variant="citizens-outline"
                  size="citizens-xl"
                  className="flex-1"
                  onClick={handleOpenZkProofModal}
                >
                  <ExternalLink className="h-4 w-4" />
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
                verifiedAt: proofData.verifiedAt,
                nearAccountId: account.nearAccountId,
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
  nearAccountId: NearAccountId
  nullifier: string
  attestationId: AttestationId
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
  attestationId: AttestationId
  verifiedAt: number
  zkProof: {
    a: [string, string]
    b: [[string, string], [string, string]]
    c: [string, string]
  }
  publicSignals: string[]
  signature: {
    accountId: NearAccountId
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
  lines.push("[1/3] Loading account data from chain...")
  lines.push(`    ✓ Found account: ${account.nearAccountId}`)
  lines.push("")

  // Step 2
  const docType = getAttestationTypeName(account.attestationId)
  lines.push(`[2/3] Verifying ZK ${docType} proof (Celo)...`)
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
  lines.push("[3/3] Verifying NEAR wallet signature...")
  if (verification.signatureValid) {
    lines.push(`    ✓ NEP-413 signature verified for ${account.nearAccountId}`)
  } else {
    lines.push(`    ✗ Signature verification failed`)
    if (verification.error && verification.zkValid) {
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
    lines.push(`  attestation_id: ${p.attestationId} (${getAttestationTypeName(p.attestationId)})`)
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
  // Terminal colors for dark background
  if (line.includes("✓")) return "text-[#ffda1e] leading-relaxed whitespace-pre"
  if (line.includes("✗") || line.toLowerCase().includes("error")) return "text-[#ff6b6b] leading-relaxed whitespace-pre"
  if (line.includes("VERIFICATION COMPLETE")) return "text-[#ffda1e] font-bold leading-relaxed whitespace-pre"
  if (line.includes("VERIFICATION FAILED")) return "text-[#ff6b6b] font-bold leading-relaxed whitespace-pre"
  if (line.startsWith(">")) return "text-[#fcfaf7] leading-relaxed whitespace-pre"
  if (line.includes("════") || line.includes("═══")) return "text-[#666666] leading-relaxed whitespace-pre"
  if (line.includes("SELF.XYZ") || line.includes("NEAR WALLET"))
    return "text-[#fcfaf7] font-bold leading-relaxed whitespace-pre"
  if (line.startsWith("[") && line.includes("]")) return "text-[#a0a0a0] leading-relaxed whitespace-pre"
  return "text-[#a0a0a0] leading-relaxed whitespace-pre"
}
