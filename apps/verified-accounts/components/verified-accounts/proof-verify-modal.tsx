"use client"

import { useCallback } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, Button } from "@near-citizens/ui"
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
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Verify ZK Proof</DialogTitle>
          <DialogDescription>Verify the Groth16 proof using snarkjs CLI</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Instructions */}
          <div className="rounded-lg bg-muted p-3 text-sm text-muted-foreground space-y-1">
            <p>
              1. Install: <code className="bg-background px-1 rounded text-xs">npm i -g snarkjs</code>
            </p>
            <p>2. Download all three files below</p>
            <p>
              3. Run:{" "}
              <code className="bg-background px-1 rounded text-xs">
                snarkjs groth16 verify vkey.json public.json proof.json
              </code>
            </p>
          </div>

          {/* Download Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <Button size="sm" onClick={() => downloadJson(proofJson, "proof.json")}>
              <Download className="h-4 w-4 mr-2" />
              proof.json
            </Button>
            <Button size="sm" onClick={() => downloadJson(publicJson, "public.json")}>
              <Download className="h-4 w-4 mr-2" />
              public.json
            </Button>
            <Button size="sm" asChild>
              <a href="/vkey.json" download="vkey.json">
                <Download className="h-4 w-4 mr-2" />
                vkey.json
              </a>
            </Button>
          </div>

          <hr className="border-border" />

          {/* Links */}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="flex-1" onClick={openSnarkjs}>
              <ExternalLink className="h-4 w-4 mr-2" />
              snarkjs
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => window.open("https://docs.self.xyz", "_blank")}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Self.xyz Docs
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            The verification key is for Self.xyz&apos;s{" "}
            <a
              href="https://github.com/selfxyz/self/blob/main/contracts/contracts/verifiers/disclose/Verifier_vc_and_disclose.sol"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-foreground"
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
