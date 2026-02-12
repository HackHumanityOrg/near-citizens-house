import { flag } from "flags/next"
import { vercelAdapter } from "@flags-sdk/vercel"

export const maintenanceMode = flag<boolean>({
  key: "maintenance-mode",
  adapter: vercelAdapter(),
  defaultValue: true,
  description: "Redirect all traffic to /maintenance",
  options: [
    { value: false, label: "Off" },
    { value: true, label: "On" },
  ],
})

export const appMode = flag<"verification" | "waiting" | "voting">({
  key: "app-mode",
  adapter: vercelAdapter(),
  defaultValue: "waiting",
  description: "Controls app phase: verification homepage, waiting page, or voting homepage",
  options: [
    { value: "verification", label: "Verification" },
    { value: "waiting", label: "Waiting" },
    { value: "voting", label: "Voting" },
  ],
})
