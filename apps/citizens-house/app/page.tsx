import { Card, CardContent, CardDescription, CardHeader, CardTitle, ThemeToggle } from "@near-citizens/ui"
import { Vote, Users, FileText } from "lucide-react"

export default function GovernancePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-background/80">
      <div className="fixed top-4 right-4 z-50">
        <ThemeToggle />
      </div>

      <div className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="text-center space-y-4">
            <h1 className="text-4xl font-bold tracking-tight">NEAR Citizens House</h1>
            <p className="text-xl text-muted-foreground">DAO Governance for Verified NEAR Citizens</p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            <Card>
              <CardHeader>
                <Vote className="h-8 w-8 mb-2 text-primary" />
                <CardTitle>Proposals</CardTitle>
                <CardDescription>Vote on community proposals and shape the future</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">Coming soon...</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <Users className="h-8 w-8 mb-2 text-primary" />
                <CardTitle>Members</CardTitle>
                <CardDescription>Browse verified citizens and their contributions</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">Coming soon...</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <FileText className="h-8 w-8 mb-2 text-primary" />
                <CardTitle>Discussions</CardTitle>
                <CardDescription>Participate in governance discussions</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">Coming soon...</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>About Citizens House</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p>
                The NEAR Citizens House is a governance body composed of verified NEAR account holders. Only accounts
                that have completed identity verification can participate in governance decisions.
              </p>
              <p className="text-sm text-muted-foreground">
                This governance interface is under development. Check back soon for voting and proposal features.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
