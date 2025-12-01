import { getVerifiedAccountsWithStatus } from "./actions"
import { VerifiedAccountsTable } from "@/components/verified-accounts/verified-accounts-table"
import { ThemeToggle } from "@near-citizens/ui"

const PAGE_SIZE = 10

interface Props {
  searchParams: Promise<{ page?: string }>
}

export default async function VerificationsPage({ searchParams }: Props) {
  const params = await searchParams
  const page = Math.max(0, parseInt(params.page || "0", 10))

  const { accounts, total } = await getVerifiedAccountsWithStatus(page, PAGE_SIZE)
  const totalPages = Math.ceil(total / PAGE_SIZE)

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
