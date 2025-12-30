import { notFound } from "next/navigation"
import Link from "next/link"
import { z } from "zod"
import { ProposalDetailWrapper } from "@/components/proposals/proposal-detail-wrapper"
import { getProposal, getPolicy } from "@/lib/actions/sputnik-dao"
import { Button } from "@near-citizens/ui"
import { ArrowLeft } from "lucide-react"

export const dynamic = "force-dynamic"

const proposalIdSchema = z.coerce.number().int().min(0)

interface ProposalPageProps {
  params: Promise<{ id: string }>
}

export default async function ProposalPage({ params }: ProposalPageProps) {
  const { id } = await params
  const parsed = proposalIdSchema.safeParse(id)

  if (!parsed.success) {
    notFound()
  }

  const proposalId = parsed.data

  const [proposal, policy] = await Promise.all([getProposal(proposalId), getPolicy()])

  if (!proposal) {
    notFound()
  }

  // Capture server time before rendering for consistent SSR
  // eslint-disable-next-line react-hooks/purity -- Date.now() is safe in server components (runs once on server)
  const serverTime = Date.now()

  return (
    <div className="min-h-screen">
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Back Button */}
        <Link href="/governance/proposals">
          <Button variant="ghost" className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Proposals
          </Button>
        </Link>

        <ProposalDetailWrapper initialProposal={proposal} policy={policy} serverTime={serverTime} />
      </main>
    </div>
  )
}
