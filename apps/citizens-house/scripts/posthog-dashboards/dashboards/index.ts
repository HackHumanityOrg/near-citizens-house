import { verificationAnalyticsDashboard } from "./verification-analytics"
import type { DashboardDefinition } from "../schemas"

export { verificationAnalyticsDashboard }

/**
 * Single high-value dashboard for verification analytics
 */
export const allDashboards: DashboardDefinition[] = [verificationAnalyticsDashboard]

export const dashboardNames = allDashboards.map((d) => d.name)
