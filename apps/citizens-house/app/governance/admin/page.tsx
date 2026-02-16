"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useNearWallet } from "@/lib"
import { Loader2 } from "lucide-react"
import { Button, Tabs, TabsContent, TabsList, TabsTrigger } from "@near-citizens/ui"
import { checkIsAdmin, checkIsSuperAdmin, getGovernanceConfig } from "../actions"
import type { GovernanceConfig } from "@/lib/schemas/governance-contract"
import { ProposalsPanel } from "@/components/governance/admin/proposals-panel"
import { CreateProposalForm } from "@/components/governance/admin/create-proposal-form"
import { ConfigPanel } from "@/components/governance/admin/config-panel"
import { AdminsPanel } from "@/components/governance/admin/admins-panel"
import { BlocklistPanel } from "@/components/governance/admin/blocklist-panel"
import { RecoveryPanel } from "@/components/governance/admin/recovery-panel"
import { StarPattern } from "@/components/verification/icons/star-pattern"

export default function AdminPage() {
  const router = useRouter()
  const { accountId, isConnected, connect, isLoading } = useNearWallet()
  const [adminCheck, setAdminCheck] = useState<{ accountId: string; isAdmin: boolean } | null>(null)
  const [superAdminEnabled, setSuperAdminEnabled] = useState<boolean | null>(null)
  const [config, setConfig] = useState<GovernanceConfig | null>(null)

  useEffect(() => {
    if (!isConnected || !accountId) return
    Promise.all([checkIsAdmin(accountId), getGovernanceConfig(), checkIsSuperAdmin()]).then(
      ([admin, cfg, isSuperAdmin]) => {
        setAdminCheck({ accountId, isAdmin: admin })
        setConfig(cfg)
        setSuperAdminEnabled(isSuperAdmin)
        if (!admin) router.replace("/governance")
      },
    )
  }, [isConnected, accountId, router])

  // Derive admin status from check result, accounting for account changes
  const isAdmin = adminCheck?.accountId === accountId ? adminCheck.isAdmin : null
  const adminLoading = isConnected && accountId && isAdmin === null
  const superAdminLoading = isConnected && accountId && superAdminEnabled === null

  function renderContent() {
    if (isLoading || adminLoading || superAdminLoading) {
      return (
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-6 w-6 animate-spin text-[#64748b]" />
        </div>
      )
    }

    if (!isConnected) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
          <p className="font-fk-grotesk text-[16px] text-[#64748b] dark:text-[#94a3b8]">
            Connect your wallet to access the admin panel.
          </p>
          <Button variant="citizens-primary" size="citizens-lg" onClick={connect}>
            Connect Wallet
          </Button>
        </div>
      )
    }

    if (isAdmin === false) {
      return (
        <div className="flex items-center justify-center min-h-[400px]">
          <p className="font-fk-grotesk text-[16px] text-[#64748b] dark:text-[#94a3b8]">
            Only admins can access this page.
          </p>
        </div>
      )
    }

    const canAccessAdvancedAdminSections = superAdminEnabled === true

    if (!canAccessAdvancedAdminSections) {
      return (
        <div className="w-full px-4 md:px-[82px] py-8 md:py-12">
          <div className="flex flex-col gap-6 max-w-[800px] mx-auto">
            <h2 className="font-fk-grotesk font-bold text-[24px] md:text-[28px] leading-[32px] text-black dark:text-white">
              Create
            </h2>
            {config && (
              <CreateProposalForm
                minProposalBond={config.minProposalBond}
                votingPeriodSecs={config.votingPeriodSecs}
                maxStartDelaySecs={config.maxStartDelaySecs}
              />
            )}
          </div>
        </div>
      )
    }

    return (
      <div className="w-full px-4 md:px-[82px] py-8 md:py-12">
        <div className="flex flex-col gap-8 max-w-[800px] mx-auto">
          <Tabs defaultValue="proposals" className="w-full">
            <TabsList className="w-full">
              <TabsTrigger value="proposals" className="flex-1">
                Proposals
              </TabsTrigger>
              <TabsTrigger value="create" className="flex-1">
                Create
              </TabsTrigger>
              <TabsTrigger value="config" className="flex-1">
                Config
              </TabsTrigger>
              <TabsTrigger value="admins" className="flex-1">
                Admins
              </TabsTrigger>
              <TabsTrigger value="blocklist" className="flex-1">
                Blocklist
              </TabsTrigger>
              <TabsTrigger value="recovery" className="flex-1">
                Recovery
              </TabsTrigger>
            </TabsList>
            <TabsContent value="proposals" className="mt-6">
              <ProposalsPanel />
            </TabsContent>
            <TabsContent value="create" className="mt-6">
              {config && (
                <CreateProposalForm
                  minProposalBond={config.minProposalBond}
                  votingPeriodSecs={config.votingPeriodSecs}
                  maxStartDelaySecs={config.maxStartDelaySecs}
                />
              )}
            </TabsContent>
            <TabsContent value="config" className="mt-6">
              <ConfigPanel />
            </TabsContent>
            <TabsContent value="admins" className="mt-6">
              <AdminsPanel />
            </TabsContent>
            <TabsContent value="blocklist" className="mt-6">
              <BlocklistPanel />
            </TabsContent>
            <TabsContent value="recovery" className="mt-6">
              <RecoveryPanel />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full">
      {/* Hero Section */}
      <section className="relative h-[480px] md:h-[560px] -mt-32 pt-32 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 w-full h-full bg-[radial-gradient(ellipse_650px_420px_at_center_30%,_rgba(255,218,30,0.4)_0%,_rgba(253,221,57,0.3)_25%,_rgba(249,230,136,0.2)_45%,_rgba(245,236,189,0.14)_60%,_rgba(242,242,242,0.06)_75%,_transparent_100%)] dark:bg-[radial-gradient(ellipse_650px_420px_at_center_30%,_rgba(255,218,30,0.28)_0%,_rgba(253,221,57,0.2)_30%,_rgba(249,230,136,0.14)_55%,_transparent_80%)]" />
        </div>

        <div
          className="absolute top-[140px] md:top-[160px] w-[372px] h-[246px] pointer-events-none z-0"
          style={{ left: "min(calc(50% + 360px), calc(100% - 200px))" }}
        >
          <StarPattern className="w-full h-full text-[#FFDA1E] dark:text-[#FFDA1E]/30" idPrefix="govAdminStar" />
        </div>

        <div className="relative flex flex-col items-center justify-start pt-[24px] md:pt-[40px] h-full px-4 md:px-8 z-10">
          <h1 className="font-fk-grotesk font-medium text-[36px] md:text-[62px] leading-[40px] md:leading-[72px] text-black dark:text-white text-center">
            Governance Admin
          </h1>
        </div>
      </section>

      {/* Content */}
      <div className="relative z-10 -mt-[240px] md:-mt-[280px] pb-[80px]">{renderContent()}</div>
    </div>
  )
}
