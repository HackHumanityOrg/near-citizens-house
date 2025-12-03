import { getVerifiedAccountsWithStatus } from "./actions"
import { VerifiedAccountsTable } from "@/components/verified-accounts/verified-accounts-table"
import { ThemeToggle } from "@near-citizens/ui"

const PAGE_SIZE = 10

interface Props {
  searchParams: Promise<{ page?: string }>
}

export default async function VerificationsPage({ searchParams }: Props) {
  const params = await searchParams
  const rawPage = parseInt(params.page || "0", 10)
  const requestedPage = Number.isNaN(rawPage) ? 0 : Math.max(0, rawPage)

  const { accounts, total } = await getVerifiedAccountsWithStatus(requestedPage, PAGE_SIZE)
  const totalPages = Math.ceil(total / PAGE_SIZE)
  // Clamp page to valid range (in case URL has out-of-bounds page number)
  const page = Math.min(requestedPage, Math.max(0, totalPages - 1))

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-background/80">
      <div className="fixed top-4 right-4 z-50">
        <ThemeToggle />
      </div>
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
