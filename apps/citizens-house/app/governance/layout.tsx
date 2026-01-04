import { redirect } from "next/navigation"
import { FEATURE_FLAGS } from "@/lib/feature-flags"

export default function GovernanceLayout({ children }: { children: React.ReactNode }) {
  if (!FEATURE_FLAGS.GOVERNANCE_ENABLED) {
    redirect("/")
  }

  return <>{children}</>
}
