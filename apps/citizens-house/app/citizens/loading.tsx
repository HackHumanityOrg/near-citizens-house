import { CitizensPageShell } from "@/components/citizens/citizens-page-shell"
import { VerificationsTableSkeleton } from "@/components/citizens/verifications-table-skeleton"

export default function VerificationsLoading() {
  return (
    <CitizensPageShell starIdPrefix="citizensLoadingStar">
      <VerificationsTableSkeleton />
    </CitizensPageShell>
  )
}
