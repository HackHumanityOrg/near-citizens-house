"use client"

import { useCallback } from "react"
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@near-citizens/ui"
import { useAnalytics } from "@/lib/analytics"
import { Download, ExternalLink } from "lucide-react"
import type { ZkProof } from "@near-citizens/shared"

// Props specific to this modal - combines proof with metadata
interface ZkProofData {
  proof: ZkProof
  publicSignals: string[]
  nullifier: string
  attestationId: string
  verifiedAt: number
  nearAccountId: string
}

interface ZkProofVerifyModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  data: ZkProofData | null
}

export function ProofVerifyModal({ open, onOpenChange, data }: ZkProofVerifyModalProps) {
  const analytics = useAnalytics()

  const downloadJson = useCallback(
    (content: object, filename: string) => {
      analytics.trackZkProofDownloaded(data?.nearAccountId || "unknown", filename)
      const blob = new Blob([JSON.stringify(content, null, 2)], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    },
    [analytics, data?.nearAccountId],
  )

  const openSnarkjs = useCallback(() => {
    analytics.trackExternalVerifierOpened("snarkjs")
    window.open("https://github.com/iden3/snarkjs", "_blank")
  }, [analytics])

  if (!data) return null

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
      <DialogContent className="sm:max-w-lg bg-white rounded-[8px] border-none shadow-xl">
        <DialogHeader>
          <DialogTitle
            className="text-[22px] leading-[28px] text-black"
            style={{ fontFamily: "'FK Grotesk Variable', sans-serif", fontWeight: 500 }}
          >
            Verify ZK Proof
          </DialogTitle>
          <DialogDescription
            className="text-[14px] leading-[1.4] text-[#828282]"
            style={{ fontFamily: "Inter, sans-serif", fontWeight: 400 }}
          >
            Verify the Groth16 proof using snarkjs CLI
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Instructions */}
          <div className="rounded-[12px] bg-[#1c1c1c] p-4 space-y-2">
            <p className="text-[13px] leading-[1.5] text-[#a0a0a0] font-mono">
              <span className="text-[#00ec97]">1.</span> Install:{" "}
              <code className="bg-[#333] px-2 py-0.5 rounded text-[#fcfaf7]">npm i -g snarkjs</code>
            </p>
            <p className="text-[13px] leading-[1.5] text-[#a0a0a0] font-mono">
              <span className="text-[#00ec97]">2.</span> Download all three files below
            </p>
            <p className="text-[13px] leading-[1.5] text-[#a0a0a0] font-mono">
              <span className="text-[#00ec97]">3.</span> Run:{" "}
              <code className="bg-[#333] px-2 py-0.5 rounded text-[#fcfaf7] text-[11px]">
                snarkjs groth16 verify vkey.json public.json proof.json
              </code>
            </p>
          </div>

          {/* Download Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <Button variant="citizens-primary" size="citizens-xl" onClick={() => downloadJson(proofJson, "proof.json")}>
              <Download className="h-4 w-4" />
              proof.json
            </Button>
            <Button
              variant="citizens-primary"
              size="citizens-xl"
              onClick={() => downloadJson(publicJson, "public.json")}
            >
              <Download className="h-4 w-4" />
              public.json
            </Button>
            <Button variant="citizens-primary" size="citizens-xl" asChild>
              <a href="/vkey.json" download="vkey.json">
                <Download className="h-4 w-4" />
                vkey.json
              </a>
            </Button>
          </div>

          <hr className="border-[#e0e0e0]" />

          {/* Links */}
          <div className="flex gap-3">
            <Button variant="citizens-outline" size="citizens-xl" className="flex-1" onClick={openSnarkjs}>
              <ExternalLink className="h-4 w-4" />
              snarkjs
            </Button>
            <Button
              variant="citizens-outline"
              size="citizens-xl"
              className="flex-1"
              onClick={() => window.open("https://docs.self.xyz", "_blank")}
            >
              <ExternalLink className="h-4 w-4" />
              Self.xyz Docs
            </Button>
          </div>

          <p className="text-[12px] leading-[1.4] text-[#828282]" style={{ fontFamily: "Inter, sans-serif" }}>
            The verification key is for Self.xyz&apos;s{" "}
            <a
              href="https://github.com/selfxyz/self/blob/main/contracts/contracts/verifiers/disclose/Verifier_vc_and_disclose.sol"
              target="_blank"
              rel="noopener noreferrer"
              className="underline text-[#040404] hover:text-[#00ec97] transition-colors"
            >
              vc_and_disclose circuit
            </a>{" "}
            (E-Passport attestation).
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
