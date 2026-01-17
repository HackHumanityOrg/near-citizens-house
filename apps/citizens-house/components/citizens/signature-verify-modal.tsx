"use client"

import { useState, useCallback } from "react"
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@near-citizens/ui"
import { trackEvent } from "@/lib/analytics"
import { Copy, Check, ExternalLink } from "lucide-react"
import type { NearAccountId } from "@/lib/schemas"

// Modal-specific type that combines nearSignatureVerification and signature fields from ProofData
interface NearSignatureData {
  nep413Hash: string
  publicKeyHex: string
  signatureHex: string
  challenge: string
  recipient: string
  accountId: NearAccountId
}

interface NearSignatureVerifyModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  data: NearSignatureData | null
}

export function SignatureVerifyModal({ open, onOpenChange, data }: NearSignatureVerifyModalProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null)

  const copyToClipboard = useCallback(
    (text: string, field: "hash" | "publicKey" | "signature") => {
      navigator.clipboard.writeText(text)
      setCopiedField(field)
      setTimeout(() => setCopiedField(null), 2000)
      if (data) {
        trackEvent({
          domain: "citizens",
          action: "copied_to_clipboard",
          viewedAccountId: data.accountId,
          field,
        })
      }
    },
    [data],
  )

  const openVerifier = useCallback(() => {
    if (data) {
      trackEvent({
        domain: "citizens",
        action: "external_verifier_opened",
        viewedAccountId: data.accountId,
        verifier: "cyphrme",
      })
    }
    window.open("https://cyphr.me/ed25519_tool/ed.html", "_blank")
  }, [data])

  if (!data) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl bg-background rounded-[8px] border-none shadow-xl">
        <DialogHeader>
          <DialogTitle
            className="text-[22px] leading-[28px] text-foreground"
            style={{ fontFamily: "'FK Grotesk Variable', sans-serif", fontWeight: 500 }}
          >
            Verify NEAR Signature
          </DialogTitle>
          <DialogDescription
            className="text-[14px] leading-[1.4] text-muted-foreground"
            style={{ fontFamily: "Inter, sans-serif", fontWeight: 400 }}
          >
            Independently verify the Ed25519 signature using Cyphr.me&apos;s online tool
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Instructions */}
          <div className="rounded-[12px] bg-secondary p-4 space-y-2 border border-border">
            <h4
              className="text-[14px] leading-[20px] text-foreground"
              style={{ fontFamily: "'FK Grotesk Variable', sans-serif", fontWeight: 500 }}
            >
              Instructions
            </h4>
            <ol
              className="list-decimal list-inside text-[13px] leading-[1.5] text-muted-foreground space-y-1"
              style={{ fontFamily: "Inter, sans-serif" }}
            >
              <li>Open the Cyphr.me Ed25519 tool (button below)</li>
              <li>
                Set Algorithm to <strong className="text-foreground">Ed25519</strong> (not Ed25519ph)
              </li>
              <li>
                Set Message encoding to <strong className="text-foreground">Hex</strong>
              </li>
              <li>
                Set Key encoding to <strong className="text-foreground">Hex</strong>
              </li>
              <li>Paste values below into Message, Public Key, and Signature fields</li>
              <li>
                Click <strong className="text-foreground">Verify</strong>
              </li>
            </ol>
          </div>

          {/* Message (NEP-413 Hash) */}
          <div className="space-y-1.5">
            <label
              className="text-[13px] leading-[1.4] text-foreground"
              style={{ fontFamily: "'FK Grotesk Variable', sans-serif", fontWeight: 500 }}
            >
              Message (NEP-413 hash, hex)
            </label>
            <div className="flex gap-2">
              <code className="flex-1 bg-[#1c1c1c] dark:bg-black/50 dark:border dark:border-white/20 text-[#a0a0a0] px-3 py-2 rounded-[8px] text-xs font-mono break-all">
                {data.nep413Hash}
              </code>
              <Button
                variant="citizens-icon"
                size="citizens-icon"
                onClick={() => copyToClipboard(data.nep413Hash, "hash")}
              >
                {copiedField === "hash" ? <Check className="h-4 w-4 text-[#ffda1e]" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-[11px] leading-[1.4] text-muted-foreground" style={{ fontFamily: "Inter, sans-serif" }}>
              This is the SHA-256 hash of the NEP-413 formatted payload (tag + Borsh-serialized message)
            </p>
          </div>

          {/* Public Key */}
          <div className="space-y-1.5">
            <label
              className="text-[13px] leading-[1.4] text-foreground"
              style={{ fontFamily: "'FK Grotesk Variable', sans-serif", fontWeight: 500 }}
            >
              Public Key (hex)
            </label>
            <div className="flex gap-2">
              <code className="flex-1 bg-[#1c1c1c] dark:bg-black/50 dark:border dark:border-white/20 text-[#a0a0a0] px-3 py-2 rounded-[8px] text-xs font-mono break-all">
                {data.publicKeyHex}
              </code>
              <Button
                variant="citizens-icon"
                size="citizens-icon"
                onClick={() => copyToClipboard(data.publicKeyHex, "publicKey")}
              >
                {copiedField === "publicKey" ? (
                  <Check className="h-4 w-4 text-[#ffda1e]" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {/* Signature */}
          <div className="space-y-1.5">
            <label
              className="text-[13px] leading-[1.4] text-foreground"
              style={{ fontFamily: "'FK Grotesk Variable', sans-serif", fontWeight: 500 }}
            >
              Signature (hex)
            </label>
            <div className="flex gap-2">
              <code className="flex-1 bg-[#1c1c1c] dark:bg-black/50 dark:border dark:border-white/20 text-[#a0a0a0] px-3 py-2 rounded-[8px] text-xs font-mono break-all">
                {data.signatureHex}
              </code>
              <Button
                variant="citizens-icon"
                size="citizens-icon"
                onClick={() => copyToClipboard(data.signatureHex, "signature")}
              >
                {copiedField === "signature" ? (
                  <Check className="h-4 w-4 text-[#ffda1e]" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {/* Technical Details */}
          <details className="text-sm">
            <summary
              className="cursor-pointer text-[13px] text-muted-foreground hover:text-foreground transition-colors"
              style={{ fontFamily: "Inter, sans-serif" }}
            >
              Technical details
            </summary>
            <div className="mt-2 rounded-[8px] bg-[#1c1c1c] dark:bg-black/50 dark:border dark:border-white/20 p-3 space-y-1 text-xs text-[#a0a0a0] font-mono">
              <p>NEP-413 Message Format:</p>
              <p className="pl-2">1. Tag: 2147484061 (4 bytes, little-endian)</p>
              <p className="pl-2">2. Borsh-serialized payload:</p>
              <p className="pl-4">- message: &quot;{data.challenge}&quot;</p>
              <p className="pl-4">- nonce: [32 bytes]</p>
              <p className="pl-4">- recipient: &quot;{data.recipient}&quot;</p>
              <p className="pl-4">- callbackUrl: null</p>
              <p className="pl-2">3. Hash = SHA-256(tag || payload)</p>
            </div>
          </details>

          {/* Action Button */}
          <Button variant="citizens-primary" size="citizens-2xl" className="w-full" onClick={openVerifier}>
            <ExternalLink className="h-4 w-4" />
            Open Cyphr.me Ed25519 Verifier
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
