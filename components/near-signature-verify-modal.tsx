"use client"

import { useState, useCallback } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Copy, Check, ExternalLink } from "lucide-react"

interface NearSignatureData {
  nep413Hash: string
  publicKeyHex: string
  signatureHex: string
  challenge: string
  recipient: string
}

interface NearSignatureVerifyModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  data: NearSignatureData | null
}

export function NearSignatureVerifyModal({ open, onOpenChange, data }: NearSignatureVerifyModalProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null)

  const copyToClipboard = useCallback((text: string, field: string) => {
    navigator.clipboard.writeText(text)
    setCopiedField(field)
    setTimeout(() => setCopiedField(null), 2000)
  }, [])

  const openVerifier = useCallback(() => {
    window.open("https://cyphr.me/ed25519_tool/ed.html", "_blank")
  }, [])

  if (!data) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Verify NEAR Signature</DialogTitle>
          <DialogDescription>
            Independently verify the Ed25519 signature using Cyphr.me&apos;s online tool
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Instructions */}
          <div className="rounded-lg bg-muted p-4 space-y-2">
            <h4 className="font-medium text-sm">Instructions</h4>
            <ol className="list-decimal list-inside text-sm text-muted-foreground space-y-1">
              <li>Open the Cyphr.me Ed25519 tool (button below)</li>
              <li>
                Set Algorithm to <strong>Ed25519</strong> (not Ed25519ph)
              </li>
              <li>
                Set Message encoding to <strong>Hex</strong>
              </li>
              <li>
                Set Key encoding to <strong>Hex</strong>
              </li>
              <li>Paste values below into Message, Public Key, and Signature fields</li>
              <li>
                Click <strong>✅ Verify</strong>
              </li>
            </ol>
          </div>

          {/* Message (NEP-413 Hash) */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Message (NEP-413 hash, hex)</label>
            <div className="flex gap-2">
              <code className="flex-1 bg-muted px-3 py-2 rounded text-xs font-mono break-all">{data.nep413Hash}</code>
              <Button
                variant="outline"
                size="sm"
                className="shrink-0"
                onClick={() => copyToClipboard(data.nep413Hash, "hash")}
              >
                {copiedField === "hash" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              This is the SHA-256 hash of the NEP-413 formatted payload (tag + Borsh-serialized message)
            </p>
          </div>

          {/* Public Key */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Public Key (hex)</label>
            <div className="flex gap-2">
              <code className="flex-1 bg-muted px-3 py-2 rounded text-xs font-mono break-all">{data.publicKeyHex}</code>
              <Button
                variant="outline"
                size="sm"
                className="shrink-0"
                onClick={() => copyToClipboard(data.publicKeyHex, "publicKey")}
              >
                {copiedField === "publicKey" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {/* Signature */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Signature (hex)</label>
            <div className="flex gap-2">
              <code className="flex-1 bg-muted px-3 py-2 rounded text-xs font-mono break-all">{data.signatureHex}</code>
              <Button
                variant="outline"
                size="sm"
                className="shrink-0"
                onClick={() => copyToClipboard(data.signatureHex, "signature")}
              >
                {copiedField === "signature" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {/* Technical Details */}
          <details className="text-sm">
            <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Technical details</summary>
            <div className="mt-2 rounded-lg bg-muted p-3 space-y-1 text-xs text-muted-foreground font-mono">
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
          <Button className="w-full" onClick={openVerifier}>
            <ExternalLink className="h-4 w-4 mr-2" />
            Open Cyphr.me Ed25519 Verifier
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
