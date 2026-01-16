import { StatusPage, StatusPageService } from "checkly/constructs"
import {
  webAppUptime,
  webAppE2ECheck,
  rpcHealthCheck,
  contractStateCheck,
  verificationActivityCheck,
  securityMonitorCheck,
} from "../../../__checks__/near-contract.check"

// =============================================================================
// Service Definitions
// =============================================================================

// Web Application Services
const webAppUptimeService = new StatusPageService("citizens-house-uptime-service", {
  name: "Web App Uptime & Performance",
  checks: [webAppUptime],
})

const webAppFunctionalityService = new StatusPageService("citizens-house-functionality-service", {
  name: "Web App UI Flow",
  checks: [webAppE2ECheck],
})

// NEAR Blockchain Services
const nearRpcService = new StatusPageService("near-rpc-service", {
  name: "NEAR RPC Connectivity",
  checks: [rpcHealthCheck],
})

// Smart Contract Services
const contractHealthService = new StatusPageService("contract-health-service", {
  name: "Contract State (Wallet & Paused Status)",
  checks: [contractStateCheck],
})

const verificationService = new StatusPageService("verification-service", {
  name: "Verification Transactions & Failures",
  checks: [verificationActivityCheck],
})

const securityService = new StatusPageService("security-service", {
  name: "Admin Function Activity Alerts",
  checks: [securityMonitorCheck],
})

// =============================================================================
// Status Page Configuration
// =============================================================================
new StatusPage("citizens-house-status", {
  name: "Citizens House Status",
  url: "citizens-house-status",

  // Branding
  favicon: "https://citizenshouse.org/favicon.ico",
  redirectTo: "https://citizenshouse.org",

  // Theme
  defaultTheme: "AUTO",

  // Service Cards
  cards: [
    {
      name: "Web Application",
      services: [webAppUptimeService, webAppFunctionalityService],
    },
    {
      name: "Smart Contract",
      services: [contractHealthService, verificationService, securityService],
    },
    {
      name: "NEAR Blockchain",
      services: [nearRpcService],
    },
  ],
})
