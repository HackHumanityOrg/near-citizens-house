import { getVerifiedAccountsWithStatus } from "./actions"
import { VerifiedAccountsTable } from "@/components/citizens/verified-accounts-table"

const PAGE_SIZE = 10

interface Props {
  searchParams: Promise<{ page?: string }>
}

export default async function VerificationsPage({ searchParams }: Props) {
  const params = await searchParams
  const rawPage = parseInt(params.page || "0", 10)
  const requestedPage = Number.isNaN(rawPage) ? 0 : Math.max(0, rawPage)

  let { accounts, total } = await getVerifiedAccountsWithStatus(requestedPage, PAGE_SIZE)
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  // If requested page is out of range and there's data, re-fetch the last valid page
  const clampedPage = Math.min(requestedPage, totalPages - 1)
  if (clampedPage !== requestedPage && total > 0) {
    const result = await getVerifiedAccountsWithStatus(clampedPage, PAGE_SIZE)
    accounts = result.accounts
    total = result.total
  }
  const page = clampedPage

  return (
    <div className="bg-background pt-8 pb-12 md:pt-[80px] md:pb-[80px]">
      <VerifiedAccountsTable
        accounts={accounts}
        total={total}
        page={page}
        pageSize={PAGE_SIZE}
        totalPages={totalPages}
      />
    </div>
  )
}
