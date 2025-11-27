import Link from "next/link"
import { List } from "lucide-react"
import { ThemeToggle } from "@/components/shared/theme-toggle"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-muted ${className}`} />
}

export default function VerificationsLoading() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-background/80">
      <div className="fixed top-4 right-4 z-50">
        <ThemeToggle />
      </div>
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-7xl mx-auto space-y-12">
          <Card className="border-0 bg-transparent shadow-none">
            <CardContent className="space-y-3 py-4">
              <div className="flex items-center">
                <Link href="/">
                  <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground hover:text-foreground">
                    ← Back to Verification
                  </Button>
                </Link>
              </div>
              <div className="text-center space-y-2">
                <div className="flex items-center justify-center gap-2">
                  <List className="h-8 w-8 text-primary" />
                  <h1 className="text-3xl font-bold">Verified Accounts</h1>
                </div>
                <p className="text-muted-foreground">All NEAR accounts verified through Self.xyz passport proofs</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 bg-transparent shadow-none">
            <CardContent className="py-8">
              <Card>
                <CardHeader>
                  <CardTitle>Verification Records</CardTitle>
                  <CardDescription className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-36" />
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="rounded-md border bg-card">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>NEAR Account</TableHead>
                          <TableHead>Attestation Type</TableHead>
                          <TableHead>User ID</TableHead>
                          <TableHead>Nullifier</TableHead>
                          <TableHead>Verified At</TableHead>
                          <TableHead>Verify</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {Array.from({ length: 5 }).map((_, i) => (
                          <TableRow key={i}>
                            <TableCell>
                              <Skeleton className="h-4 w-32" />
                            </TableCell>
                            <TableCell>
                              <Skeleton className="h-4 w-20" />
                            </TableCell>
                            <TableCell>
                              <Skeleton className="h-4 w-24" />
                            </TableCell>
                            <TableCell>
                              <Skeleton className="h-4 w-20" />
                            </TableCell>
                            <TableCell>
                              <Skeleton className="h-4 w-36" />
                            </TableCell>
                            <TableCell>
                              <Skeleton className="h-8 w-20 rounded-md" />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
