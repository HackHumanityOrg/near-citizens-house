"use client"

import { useState } from "react"
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle } from "@near-citizens/ui"
import { trackEvent } from "@/lib/analytics"
import { ShieldCheck, ExternalLink } from "lucide-react"
import { SignatureVerifyModal } from "./signature-verify-modal"
import type { VerificationWithStatus } from "@/app/citizens/actions"
import type { SignatureVerificationData } from "@/lib/schemas/verification-signature"
import type { TransformedVerification } from "@/lib/schemas/verification-contract"

interface Props {
  data: VerificationWithStatus | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function VerificationDetailsDialog({ data, open, onOpenChange }: Props) {
  const [showSignatureModal, setShowSignatureModal] = useState(false)

  if (!data) return null

  const handleOpenSignatureModal = () => {
    trackEvent({
      domain: "citizens",
      action: "signature_verify_opened",
      viewedAccountId: data.account.nearAccountId,
    })
    setShowSignatureModal(true)
  }

  const { account, verification, signatureData } = data

  // Build terminal output lines (static, no animation)
  const lines = buildTerminalOutput(account, verification, signatureData)

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-2xl bg-background dark:bg-black dark:border dark:border-white/20 rounded-[8px] border-none shadow-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[22px] leading-[28px] text-foreground font-fk-grotesk font-medium">
              <ShieldCheck className="h-5 w-5 text-[#ffda1e]" />
              Verification Details
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
          {verification.signatureValid && signatureData && (
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
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Sub-modal for signature verification */}
      <SignatureVerifyModal open={showSignatureModal} onOpenChange={setShowSignatureModal} data={signatureData} />
    </>
  )
}

interface VerificationResult {
  signatureValid: boolean
  error?: string
}

function buildTerminalOutput(
  account: TransformedVerification,
  verification: VerificationResult,
  signatureData: SignatureVerificationData | null,
): string[] {
  const lines: string[] = []

  lines.push(`> Verifying ${account.nearAccountId}`)
  lines.push("")

  // Step 1
  lines.push("[1/2] Loading account data from chain...")
  lines.push(`    ✓ Found account: ${account.nearAccountId}`)
  lines.push("")

  // Step 2
  lines.push("[2/2] Verifying NEAR wallet signature...")
  if (verification.signatureValid) {
    lines.push(`    ✓ NEP-413 signature verified for ${account.nearAccountId}`)
  } else {
    lines.push(`    ✗ Signature verification failed`)
    if (verification.error) {
      lines.push(`    Error: ${verification.error}`)
    }
  }
  lines.push("")

  // Show verification data if signature verification succeeded
  if (verification.signatureValid && signatureData) {
    lines.push("")
    lines.push("════════════════════════════════════════════════════════════════════════════════")
    lines.push("VERIFICATION DATA")
    lines.push("════════════════════════════════════════════════════════════════════════════════")
    lines.push("")
    lines.push(`  near_account_id: ${account.nearAccountId}`)
    lines.push(`  verified_at: ${account.verifiedAt}`)
    lines.push(`  verified_at_iso: ${new Date(account.verifiedAt).toISOString()}`)
    lines.push("")
    lines.push("════════════════════════════════════════════════════════════════════════════════")
    lines.push("NEAR WALLET SIGNATURE (NEP-413)")
    lines.push("════════════════════════════════════════════════════════════════════════════════")
    lines.push("")
    lines.push(`  account_id: ${signatureData.accountId}`)
    lines.push(`  nep413_hash: ${signatureData.nep413Hash}`)
    lines.push(`  public_key_hex: ${signatureData.publicKeyHex}`)
    lines.push(`  signature_hex: ${signatureData.signatureHex}`)
    lines.push(`  challenge: ${signatureData.challenge}`)
    lines.push(`  recipient: ${signatureData.recipient}`)
    lines.push("")
  }

  // Final status
  lines.push("")
  if (verification.signatureValid) {
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
  if (line.includes("VERIFICATION DATA") || line.includes("NEAR WALLET"))
    return "text-[#fcfaf7] font-bold leading-relaxed whitespace-pre"
  if (line.startsWith("[") && line.includes("]")) return "text-[#a0a0a0] leading-relaxed whitespace-pre"
  return "text-[#a0a0a0] leading-relaxed whitespace-pre"
}
