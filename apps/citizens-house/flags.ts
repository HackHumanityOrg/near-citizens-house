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
