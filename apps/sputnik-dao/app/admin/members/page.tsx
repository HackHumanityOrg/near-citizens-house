import { AddMemberForm } from "@/components/admin/add-member-form"

export default function AdminMembersPage() {
  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-2">Add Citizen</h1>
        <p className="text-muted-foreground">Add verified accounts as citizen members</p>
      </div>

      <AddMemberForm />
    </div>
  )
}
