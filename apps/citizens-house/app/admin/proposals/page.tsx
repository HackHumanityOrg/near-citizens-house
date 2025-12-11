import { CreateProposalForm } from "@/components/admin/create-proposal-form"

export default function AdminProposalsPage() {
  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-2">Create Proposal</h1>
        <p className="text-muted-foreground">Create a new vote proposal for citizens to discuss and vote on</p>
      </div>

      <CreateProposalForm />
    </div>
  )
}
