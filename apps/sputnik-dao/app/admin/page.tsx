import { BridgeInfoCard } from "@/components/admin/bridge-info-card"

export default function AdminDashboardPage() {
  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-2">Admin Dashboard</h1>
        <p className="text-muted-foreground">Manage the SputnikDAO bridge and citizen membership</p>
      </div>

      <BridgeInfoCard />
    </div>
  )
}
