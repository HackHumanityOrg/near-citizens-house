import Link from "next/link"
import { List } from "lucide-react"
import {
  ThemeToggle,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@near-citizens/ui"

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-muted ${className}`} />
}

export default function VerificationsLoading() {
  return (
    <div className="min-h-screen bg-linear-to-b from-background to-background/80">
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
                    {/* text-sm = 14px height, matches "Showing X of Y verified accounts" */}
                    <Skeleton className="h-[14px] w-[220px]" />
                    {/* text-xs = 12px height, matches "View contract on NearBlocks" */}
                    <Skeleton className="h-[12px] w-[160px]" />
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="rounded-md border bg-card">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="min-w-[180px]">NEAR Account</TableHead>
                          <TableHead className="min-w-[120px]">Attestation Type</TableHead>
                          <TableHead className="min-w-[140px]">User ID</TableHead>
                          <TableHead className="min-w-[120px]">Nullifier</TableHead>
                          <TableHead className="min-w-[180px]">Verified At</TableHead>
                          <TableHead className="min-w-[100px]">Verify</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {Array.from({ length: 5 }).map((_, i) => (
                          <TableRow key={i}>
                            {/* NEAR Account: font-mono text-sm = 14px */}
                            <TableCell className="font-mono text-sm">
                              <Skeleton className="h-[14px] w-[140px]" />
                            </TableCell>
                            {/* Attestation Type: font-medium (default 14px) */}
                            <TableCell className="font-medium">
                              <Skeleton className="h-[14px] w-[70px]" />
                            </TableCell>
                            {/* User ID: font-mono text-xs = 12px */}
                            <TableCell className="font-mono text-xs text-muted-foreground">
                              <Skeleton className="h-[12px] w-[100px]" />
                            </TableCell>
                            {/* Nullifier: font-mono text-xs = 12px */}
                            <TableCell className="font-mono text-xs text-muted-foreground">
                              <Skeleton className="h-[12px] w-[80px]" />
                            </TableCell>
                            {/* Verified At: text-sm = 14px */}
                            <TableCell className="text-sm text-muted-foreground">
                              <Skeleton className="h-[14px] w-[160px]" />
                            </TableCell>
                            {/* Verify: Button size="sm" with icon + text */}
                            <TableCell>
                              <Button variant="outline" size="sm" disabled className="opacity-50">
                                <Skeleton className="h-4 w-4 rounded-full" />
                                <span className="ml-1">Details</span>
                              </Button>
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
