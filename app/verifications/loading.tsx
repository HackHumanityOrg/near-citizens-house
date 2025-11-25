import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { List } from "lucide-react"
import Link from "next/link"

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-muted rounded ${className || ""}`} />
}

export default function Loading() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-background/80">
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-6xl mx-auto space-y-8">
          <div>
            <Link href="/" className="text-sm text-primary hover:underline">
              &larr; Back to Verification
            </Link>
          </div>

          <div className="text-center space-y-2">
            <div className="flex items-center justify-center gap-2">
              <List className="h-8 w-8 text-primary" />
              <h1 className="text-3xl font-bold">Verified Accounts</h1>
            </div>
            <p className="text-muted-foreground">All NEAR accounts verified through Self.xyz passport proofs</p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Verification Records</CardTitle>
              <CardDescription>Loading verified accounts...</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>NEAR Account</TableHead>
                      <TableHead>Attestation Type</TableHead>
                      <TableHead>User ID</TableHead>
                      <TableHead>Nullifier</TableHead>
                      <TableHead>Verified At</TableHead>
                      <TableHead>Re-verify</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell>
                          <Skeleton className="h-4 w-40" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-20" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-28" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-24" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-32" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-8 w-8 rounded-md" />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
