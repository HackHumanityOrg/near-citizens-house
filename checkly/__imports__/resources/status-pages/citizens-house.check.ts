import { StatusPage, StatusPageService } from "checkly/constructs"

// =============================================================================
// Service Definitions
// =============================================================================
// StatusPageService only takes a 'name' property.
// Note: To link checks to services automatically, use 'triggerIncident' on each check.
// This requires a higher Checkly plan with automated incident management.
// See: https://www.checklyhq.com/docs/communicate/status-pages/incidents/#incident-automation
// =============================================================================

// Web Application Services
const webAppUptimeService = new StatusPageService("citizens-house-uptime-service", {
  name: "Web App Uptime & Performance",
})

const webAppFunctionalityService = new StatusPageService("citizens-house-functionality-service", {
  name: "Web App UI Flow",
})

// NEAR Blockchain Services
const nearRpcService = new StatusPageService("near-rpc-service", {
  name: "NEAR RPC Connectivity",
})

// Smart Contract Services
const contractHealthService = new StatusPageService("contract-health-service", {
  name: "Contract State (Wallet & Paused Status)",
})

const verificationService = new StatusPageService("verification-service", {
  name: "Verification Transactions & Failures",
})

const securityService = new StatusPageService("security-service", {
  name: "Admin Function Activity Alerts",
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
