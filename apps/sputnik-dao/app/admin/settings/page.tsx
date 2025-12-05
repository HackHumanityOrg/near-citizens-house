import { UpdateSettingsForm } from "@/components/admin/update-settings-form"

export default function AdminSettingsPage() {
  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-2">Settings</h1>
        <p className="text-muted-foreground">
          Update bridge contract configuration
        </p>
      </div>

      <UpdateSettingsForm />
    </div>
  )
}
