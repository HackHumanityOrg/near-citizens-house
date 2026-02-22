import { Suspense } from "react"
import { getVerificationsWithStatus } from "./actions"
import { VerificationsTable } from "@/components/citizens/verifications-table"
import { CitizensPageShell } from "@/components/citizens/citizens-page-shell"
import { VerificationsTableSkeleton } from "@/components/citizens/verifications-table-skeleton"

const PAGE_SIZE = 10

interface Props {
  searchParams: Promise<{ page?: string }>
}

function CitizensTableFallback() {
  return <VerificationsTableSkeleton />
}

export default async function VerificationsPage({ searchParams }: Props) {
  const params = await searchParams
  const rawPage = parseInt(params.page || "0", 10)
  const requestedPage = Number.isNaN(rawPage) ? 0 : Math.max(0, rawPage)

  return (
    <CitizensPageShell starIdPrefix="citizensStar">
      <Suspense key={requestedPage} fallback={<CitizensTableFallback />}>
        <VerificationsPageContent requestedPage={requestedPage} />
      </Suspense>
    </CitizensPageShell>
  )
}

async function VerificationsPageContent({ requestedPage }: { requestedPage: number }) {
  let { accounts, total } = await getVerificationsWithStatus(requestedPage, PAGE_SIZE)
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  // If requested page is out of range and there's data, re-fetch the last valid page
  const clampedPage = Math.min(requestedPage, totalPages - 1)
  if (clampedPage !== requestedPage && total > 0) {
    const result = await getVerificationsWithStatus(clampedPage, PAGE_SIZE)
    accounts = result.accounts
    total = result.total
  }
  const page = clampedPage

  return (
    <VerificationsTable accounts={accounts} total={total} page={page} pageSize={PAGE_SIZE} totalPages={totalPages} />
  )
}
