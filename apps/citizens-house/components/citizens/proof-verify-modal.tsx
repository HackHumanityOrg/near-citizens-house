"use client"

import { useCallback } from "react"
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@near-citizens/ui"
import { getAttestationTypeName } from "@/lib"
import { trackEvent } from "@/lib/analytics"
import { Download, ExternalLink } from "lucide-react"
import type { ZkProof } from "@/lib"
import type { AttestationId, NearAccountId } from "@/lib/schemas"

/**
 * Get the verification key filename based on attestation type.
 * Different attestation types use different circuits with different verification keys.
 */
function getVkeyFilename(attestationId: AttestationId): string {
  switch (attestationId) {
    case 1:
      return "vkey-passport.json"
    case 2:
      return "vkey-national-id.json"
    case 3:
      return "vkey-aadhaar.json"
  }
}

// Props specific to this modal - combines proof with metadata
interface ZkProofData {
  proof: ZkProof
  publicSignals: string[]
  nullifier: string
  attestationId: AttestationId
  verifiedAt: number
  nearAccountId: NearAccountId
}

interface ZkProofVerifyModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  data: ZkProofData | null
}

export function ProofVerifyModal({ open, onOpenChange, data }: ZkProofVerifyModalProps) {
  const downloadJson = useCallback(
    (content: object, filename: string, fileType: "proof" | "public_signals") => {
      const blob = new Blob([JSON.stringify(content, null, 2)], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      if (data) {
        trackEvent({
          domain: "citizens",
          action: "file_downloaded",
          viewedAccountId: data.nearAccountId,
          fileType,
        })
      }
    },
    [data],
  )

  const handleVkeyDownload = useCallback(() => {
    if (data) {
      trackEvent({
        domain: "citizens",
        action: "file_downloaded",
        viewedAccountId: data.nearAccountId,
        fileType: "verification_key",
      })
    }
  }, [data])

  const openSnarkjs = useCallback(() => {
    if (data) {
      trackEvent({
        domain: "citizens",
        action: "external_verifier_opened",
        viewedAccountId: data.nearAccountId,
        verifier: "snarkjs_docs",
      })
    }
    window.open("https://github.com/iden3/snarkjs", "_blank")
  }, [data])

  const openSelfDocs = useCallback(() => {
    if (data) {
      trackEvent({
        domain: "citizens",
        action: "external_verifier_opened",
        viewedAccountId: data.nearAccountId,
        verifier: "self_docs",
      })
    }
    window.open("https://docs.self.xyz", "_blank")
  }, [data])

  if (!data) return null

  const vkeyFile = getVkeyFilename(data.attestationId)
  const docType = getAttestationTypeName(data.attestationId)

  const proofJson = {
    pi_a: data.proof.a,
    pi_b: data.proof.b,
    pi_c: data.proof.c,
    protocol: "groth16",
    curve: "bn128",
  }

  const publicJson = data.publicSignals

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg bg-background rounded-[8px] border-none shadow-xl">
        <DialogHeader>
          <DialogTitle
            className="text-[22px] leading-[28px] text-foreground"
            style={{ fontFamily: "'FK Grotesk Variable', sans-serif", fontWeight: 500 }}
          >
            Verify ZK Proof
          </DialogTitle>
          <DialogDescription
            className="text-[14px] leading-[1.4] text-muted-foreground"
            style={{ fontFamily: "Inter, sans-serif", fontWeight: 400 }}
          >
            Verify the Groth16 proof using snarkjs CLI
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Instructions */}
          <div className="rounded-[12px] bg-[#1c1c1c] dark:bg-black/50 dark:border dark:border-white/20 p-4 space-y-2">
            <p className="text-[13px] leading-[1.5] text-[#a0a0a0] font-mono">
              <span className="text-[#ffda1e]">1.</span> Install:{" "}
              <code className="bg-[#333] dark:bg-white/10 px-2 py-0.5 rounded text-[#fcfaf7]">npm i -g snarkjs</code>
            </p>
            <p className="text-[13px] leading-[1.5] text-[#a0a0a0] font-mono">
              <span className="text-[#ffda1e]">2.</span> Download all three files below
            </p>
            <p className="text-[13px] leading-[1.5] text-[#a0a0a0] font-mono">
              <span className="text-[#ffda1e]">3.</span> Run:{" "}
              <code className="bg-[#333] dark:bg-white/10 px-2 py-0.5 rounded text-[#fcfaf7] text-[11px]">
                snarkjs groth16 verify {vkeyFile} public.json proof.json
              </code>
            </p>
          </div>

          {/* Download Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <Button
              variant="citizens-primary"
              size="citizens-xl"
              onClick={() => downloadJson(proofJson, "proof.json", "proof")}
            >
              <Download className="h-4 w-4" />
              proof.json
            </Button>
            <Button
              variant="citizens-primary"
              size="citizens-xl"
              onClick={() => downloadJson(publicJson, "public.json", "public_signals")}
            >
              <Download className="h-4 w-4" />
              public.json
            </Button>
            <Button variant="citizens-primary" size="citizens-xl" asChild>
              <a href={`/${vkeyFile}`} download={vkeyFile} onClick={handleVkeyDownload}>
                <Download className="h-4 w-4" />
                {vkeyFile}
              </a>
            </Button>
          </div>

          <hr className="border-border" />

          {/* Links */}
          <div className="flex gap-3">
            <Button variant="citizens-outline" size="citizens-xl" className="flex-1" onClick={openSnarkjs}>
              <ExternalLink className="h-4 w-4" />
              snarkjs
            </Button>
            <Button variant="citizens-outline" size="citizens-xl" className="flex-1" onClick={openSelfDocs}>
              <ExternalLink className="h-4 w-4" />
              Self.xyz Docs
            </Button>
          </div>

          <p className="text-[12px] leading-[1.4] text-muted-foreground" style={{ fontFamily: "Inter, sans-serif" }}>
            The verification key is for Self.xyz&apos;s {docType} circuit. View the{" "}
            <a
              href="https://github.com/selfxyz/self/tree/main/contracts/contracts/verifiers/disclose"
              target="_blank"
              rel="noopener noreferrer"
              className="underline text-foreground hover:text-[#ffda1e] transition-colors"
            >
              verifier contracts on GitHub
            </a>
            .
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
