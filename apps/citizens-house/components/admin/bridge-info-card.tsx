"use client"

import useSWRImmutable from "swr/immutable"
import { Card, CardHeader, CardTitle, CardContent, CardDescription, Badge } from "@near-citizens/ui"
import { type TransformedPolicy, type WeightOrRatio, formatProposalBond } from "@near-citizens/shared"
import { getBridgeInfo } from "@/lib/actions/bridge"
import { getPolicy } from "@/lib/actions/sputnik-dao"
import { Wallet, Users, FileText, Settings, Shield, Globe, Clock, Coins, Vote, Link as LinkIcon } from "lucide-react"

/**
 * Formats a vote threshold for display.
 * Handles both ratio thresholds [numerator, denominator] and fixed weight thresholds.
 * @param threshold - The threshold value from the policy (WeightOrRatio from SputnikDAO contract)
 * @param suffix - Optional suffix to append (e.g., " approval required")
 * @param fallback - Fallback text when threshold is invalid (default: "N/A")
 */
function formatThreshold(threshold: WeightOrRatio, suffix = "", fallback = "N/A"): string {
  if (Array.isArray(threshold)) {
    const [numerator, denominator] = threshold
    // Guard both numerator and denominator to prevent NaN%
    if (Number.isFinite(numerator) && Number.isFinite(denominator) && denominator > 0) {
      return `>${Math.round((numerator / denominator) * 100)}%${suffix}`
    }
    return fallback
  }
  // Type guard for Weight property (U128 serializes as string from NEAR contract)
  if (typeof threshold === "object" && threshold !== null && "Weight" in threshold) {
    return `${String(threshold.Weight)} votes${suffix}`
  }
  return fallback
}

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-[#e2e8f0] dark:bg-white/10 ${className}`} />
}

export function BridgeInfoCard() {
  const { data, isLoading, error } = useSWRImmutable("bridge-and-policy", async () => {
    const [bridgeInfo, daoPolicy] = await Promise.all([getBridgeInfo(), getPolicy()])
    return { info: bridgeInfo, policy: daoPolicy }
  })

  const info = data?.info ?? null
  const policy = data?.policy ?? null

  if (isLoading) {
    const statCards = Array.from({ length: 5 })
    const configItems = Array.from({ length: 4 })
    const policyItems = Array.from({ length: 4 })
    const roleCards = Array.from({ length: 3 })

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {statCards.map((_, index) => (
            <Card key={index} className="py-4">
              <CardContent className="flex items-center gap-3">
                <Skeleton className="h-9 w-9 rounded-lg" />
                <div className="space-y-2">
                  <Skeleton className="h-6 w-16" />
                  <Skeleton className="h-4 w-20" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2">
                <Skeleton className="h-5 w-5 rounded" />
                <Skeleton className="h-5 w-40" />
              </div>
              <Skeleton className="h-4 w-48" />
            </CardHeader>
            <CardContent className="space-y-3">
              {configItems.map((_, index) => (
                <div key={index} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                  <Skeleton className="h-4 w-4 rounded" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-3 w-full" />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2">
                <Skeleton className="h-5 w-5 rounded" />
                <Skeleton className="h-5 w-40" />
              </div>
              <Skeleton className="h-4 w-56" />
            </CardHeader>
            <CardContent className="space-y-3">
              {policyItems.map((_, index) => (
                <div key={index} className="flex justify-between items-start p-3 rounded-lg bg-muted/50">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                  <Skeleton className="h-4 w-20" />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-5 rounded" />
              <Skeleton className="h-5 w-28" />
            </div>
            <Skeleton className="h-4 w-56" />
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-4">
              {roleCards.map((_, index) => (
                <div key={index} className="p-4 rounded-lg border bg-card h-full flex flex-col">
                  <div className="flex items-center justify-between mb-4">
                    <Skeleton className="h-5 w-24" />
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </div>
                  <div className="space-y-3">
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-5/6" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error || !info || !info.backendWallet) {
    return (
      <Card>
        <CardContent className="py-6">
          <p className="text-destructive">
            {error ? "Failed to load bridge info." : !info ? "Failed to load bridge info." : "Missing bridge data."}
          </p>
        </CardContent>
      </Card>
    )
  }

  // Calculate citizen count and quorum
  const citizenRole = policy?.roles.find((r) => r.name === "citizen")
  const citizenCount =
    citizenRole && typeof citizenRole.kind === "object" && "Group" in citizenRole.kind
      ? citizenRole.kind.Group.length
      : 0
  const citizenQuorum = citizenRole?.votePolicy?.vote?.quorum ?? policy?.defaultVotePolicy.quorum ?? "0"

  return (
    <div className="space-y-6">
      {/* Stats Overview Bar */}
      {policy && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card className="py-4">
            <CardContent className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900">
                <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{citizenCount}</p>
                <p className="text-sm text-muted-foreground">Citizens</p>
              </div>
            </CardContent>
          </Card>
          <Card className="py-4">
            <CardContent className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900">
                <Coins className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{formatProposalBond(policy.proposalBond)}</p>
                <p className="text-sm text-muted-foreground">Proposal Bond</p>
              </div>
            </CardContent>
          </Card>
          <Card className="py-4">
            <CardContent className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900">
                <Clock className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{Math.round(policy.proposalPeriodMs / (24 * 60 * 60 * 1000))} days</p>
                <p className="text-sm text-muted-foreground">Voting Period</p>
              </div>
            </CardContent>
          </Card>
          <Card className="py-4">
            <CardContent className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900">
                <Vote className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{formatThreshold(policy.defaultVotePolicy.threshold)}</p>
                <p className="text-sm text-muted-foreground">Pass Threshold</p>
              </div>
            </CardContent>
          </Card>
          <Card className="py-4">
            <CardContent className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-900">
                <Users className="h-5 w-5 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{citizenQuorum}</p>
                <p className="text-sm text-muted-foreground">Quorum</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Two column layout for Bridge Config and Default Vote Policy */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Bridge Configuration */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Settings className="h-5 w-5" />
              Bridge Configuration
            </CardTitle>
            <CardDescription>Contract addresses and settings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <ConfigItem icon={<Wallet className="h-4 w-4" />} label="Backend Wallet" value={info.backendWallet} />
            <ConfigItem icon={<FileText className="h-4 w-4" />} label="SputnikDAO Contract" value={info.sputnikDao} />
            <ConfigItem
              icon={<LinkIcon className="h-4 w-4" />}
              label="Verified Accounts"
              value={info.verifiedAccountsContract}
            />
            <ConfigItem icon={<Shield className="h-4 w-4" />} label="Citizen Role" value={info.citizenRole} />
          </CardContent>
        </Card>

        {/* Default Vote Policy */}
        {policy && (
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Vote className="h-5 w-5" />
                Default Vote Policy
              </CardTitle>
              <CardDescription>Fallback rules when role has no specific policy</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <PolicyItem
                label="Threshold"
                value={formatThreshold(policy.defaultVotePolicy.threshold, " approval required", "Threshold unknown")}
              />
              <PolicyItem label="Quorum" value={`${policy.defaultVotePolicy.quorum} minimum votes`} />
              <PolicyItem label="Weight Kind" value={policy.defaultVotePolicy.weightKind} />
              <PolicyItem
                label="Bounty Bond"
                value={formatProposalBond(policy.bountyBond)}
                description="Required deposit for bounty claims"
              />
            </CardContent>
          </Card>
        )}
      </div>

      {/* Roles */}
      {policy && (
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Shield className="h-5 w-5" />
              Roles ({policy.roles.length})
            </CardTitle>
            <CardDescription>Role permissions and custom vote policies</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-4">
              {policy.roles.map((role) => (
                <RoleCard key={role.name} role={role} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// Helper components
function ConfigItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
      <div className="text-muted-foreground mt-0.5">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground break-all font-mono">{value}</p>
      </div>
    </div>
  )
}

function PolicyItem({ label, value, description }: { label: string; value: string; description?: string }) {
  return (
    <div className="flex justify-between items-start p-3 rounded-lg bg-muted/50">
      <div>
        <span className="text-sm text-muted-foreground">{label}</span>
        {description && <p className="text-xs text-muted-foreground/70">{description}</p>}
      </div>
      <span className="text-sm font-medium text-right">{value}</span>
    </div>
  )
}

function RoleCard({ role }: { role: TransformedPolicy["roles"][0] }) {
  const getRoleKindInfo = () => {
    if (role.kind === "Everyone") {
      return { icon: <Globe className="h-4 w-4" />, label: "Everyone" }
    }
    if (typeof role.kind === "object" && "Group" in role.kind) {
      const count = role.kind.Group.length
      return { icon: <Users className="h-4 w-4" />, label: `${count} member${count !== 1 ? "s" : ""}` }
    }
    return { icon: <Shield className="h-4 w-4" />, label: "Unknown" }
  }

  const kindInfo = getRoleKindInfo()

  // Get vote policy details (sorted for stable rendering order)
  const votePolicies = role.votePolicy ? Object.entries(role.votePolicy).sort(([a], [b]) => a.localeCompare(b)) : []

  return (
    <div className="p-4 rounded-lg border bg-card h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold capitalize text-lg">{role.name}</h3>
        <Badge variant="secondary" className="flex items-center gap-1">
          {kindInfo.icon}
          <span className="text-xs">{kindInfo.label}</span>
        </Badge>
      </div>

      {/* Content */}
      <div className="flex-1 space-y-4 text-sm">
        {/* Permissions - vertical list, sorted alphabetically */}
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Permissions</p>
          <div className="space-y-1">
            {[...role.permissions].sort().map((perm) => (
              <code key={perm} className="block text-xs bg-muted px-2 py-1.5 rounded font-mono truncate" title={perm}>
                {perm}
              </code>
            ))}
          </div>
        </div>

        {/* Vote Policy (if custom) */}
        {votePolicies.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Vote Policy</p>
            {votePolicies.map(([proposalType, vp]) => (
              <div key={proposalType} className="bg-muted/50 p-2 rounded text-xs">
                <span className="font-medium">{proposalType}:</span>{" "}
                {formatThreshold(vp.threshold, "", "Threshold unknown")}
                <span className="text-muted-foreground"> (quorum: {vp.quorum})</span>
              </div>
            ))}
          </div>
        )}

        {/* Members (if Group) */}
        {typeof role.kind === "object" && "Group" in role.kind && (
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Members</p>
            <div className="space-y-1 max-h-24 overflow-y-auto">
              {role.kind.Group.map((member) => (
                <code
                  key={member}
                  className="block text-xs bg-muted px-2 py-1.5 rounded font-mono truncate"
                  title={member}
                >
                  {member}
                </code>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
