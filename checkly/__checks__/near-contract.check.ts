import path from "path"
import {
  ApiCheck,
  AssertionBuilder,
  BrowserCheck,
  CheckGroupV2,
  Frequency,
  MultiStepCheck,
  RetryStrategyBuilder,
  UrlAssertionBuilder,
  UrlMonitor,
} from "checkly/constructs"

// =============================================================================
// Check Groups
// =============================================================================
// We use TWO separate groups to control which checks run during Vercel deployments:
//
// 1. deploymentChecksGroup - Linked to Vercel integration
//    - Web App E2E tests that validate the deployment
//    - These run on every Vercel preview/production deployment
//
// 2. scheduledMonitoringGroup - NOT linked to Vercel integration
//    - Contract state monitoring, verification activity, security alerts
//    - These run on a schedule only, not during deployments
//    - They monitor the NEAR blockchain, not the web app deployment
// =============================================================================

// Group for checks that should run during Vercel deployments
const deploymentChecksGroup = new CheckGroupV2("citizens-house-deployment-checks", {
  name: "Citizens House Deployment Checks",
  activated: true,
  muted: false,
  locations: ["us-east-1", "eu-central-1"],
  tags: ["near", "citizens-house", "deployment"],
  retryStrategy: RetryStrategyBuilder.fixedStrategy({
    baseBackoffSeconds: 30,
    maxRetries: 2,
    sameRegion: true,
  }),
})

// Group for scheduled monitoring checks (NOT triggered by Vercel deployments)
const scheduledMonitoringGroup = new CheckGroupV2("citizens-house-scheduled-monitoring", {
  name: "Citizens House Scheduled Monitoring",
  activated: true,
  muted: false,
  locations: ["us-east-1", "eu-central-1"],
  tags: ["near", "citizens-house", "scheduled"],
  retryStrategy: RetryStrategyBuilder.fixedStrategy({
    baseBackoffSeconds: 30,
    maxRetries: 2,
    sameRegion: true,
  }),
})

// Environment variables are configured globally in Checkly account settings.
// Required variables:
// - NEAR_CONTRACT_ID: The verification contract to monitor
// - NEAR_BACKEND_WALLET: Expected backend wallet address
// - NEAR_RPC_URL: NEAR RPC endpoint
// - NEARBLOCKS_API_URL: NearBlocks API endpoint

// =============================================================================
// URL Monitor: Website uptime and response time
// Note: UrlMonitor doesn't support groups or retry strategies
// =============================================================================
export const webAppUptime = new UrlMonitor("citizens-house-uptime", {
  name: "Web App Uptime & Performance",
  activated: true,
  muted: false,
  frequency: Frequency.EVERY_5M,
  locations: ["us-east-1", "eu-central-1"],
  tags: ["near", "citizens-house", "web"],
  request: {
    url: "https://citizenshouse.org",
    followRedirects: true,
    assertions: [UrlAssertionBuilder.statusCode().lessThan(400)],
  },
  degradedResponseTime: 3000,
  maxResponseTime: 8000,
})

// =============================================================================
// API Check: NEAR RPC availability (lightweight)
// Uses FastNEAR mainnet RPC endpoint directly.
//
// IMPORTANT: This check is NOT in the monitoringGroup to prevent Checkly's
// Vercel integration from substituting the URL with ENVIRONMENT_URL.
// The Vercel integration auto-replaces hostnames in API checks within groups
// linked to deployments, which would cause this check to hit the Vercel app
// instead of the NEAR RPC endpoint.
// =============================================================================
export const rpcHealthCheck = new ApiCheck("near-rpc-health", {
  name: "NEAR RPC Connectivity",
  // NOTE: Intentionally NOT in a group to prevent Vercel URL substitution
  activated: true,
  muted: false,
  frequency: Frequency.EVERY_5M,
  locations: ["us-east-1", "eu-central-1"],
  tags: ["near", "citizens-house", "rpc"],
  degradedResponseTime: 2000,
  maxResponseTime: 5000,
  retryStrategy: RetryStrategyBuilder.fixedStrategy({
    baseBackoffSeconds: 30,
    maxRetries: 2,
    sameRegion: true,
  }),
  request: {
    method: "POST",
    url: "https://rpc.mainnet.fastnear.com",
    headers: [{ key: "Content-Type", value: "application/json" }],
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: "health",
      method: "status",
      params: [],
    }),
    assertions: [
      AssertionBuilder.statusCode().equals(200),
      AssertionBuilder.jsonBody("$.result.sync_info").isNotNull(),
    ],
  },
})

// =============================================================================
// MultiStepCheck: Contract State (is_paused, backend_wallet, state_version)
// NOTE: In scheduledMonitoringGroup - runs on schedule, NOT during deployments
// =============================================================================
export const contractStateCheck = new MultiStepCheck("near-contract-state", {
  name: "Contract State (Wallet & Paused Status)",
  group: scheduledMonitoringGroup,
  runtimeId: "2025.04",
  frequency: Frequency.EVERY_10M,
  code: {
    entrypoint: path.join(__dirname, "contract-state.spec.ts"),
  },
})

// =============================================================================
// MultiStepCheck: Verification Activity
// NOTE: In scheduledMonitoringGroup - runs on schedule, NOT during deployments
// =============================================================================
export const verificationActivityCheck = new MultiStepCheck("near-verification-activity", {
  name: "Verification Transactions & Failures",
  group: scheduledMonitoringGroup,
  runtimeId: "2025.04",
  frequency: Frequency.EVERY_10M,
  code: {
    entrypoint: path.join(__dirname, "verification-activity.spec.ts"),
  },
})

// =============================================================================
// MultiStepCheck: Security Monitor (admin method calls)
// NOTE: In scheduledMonitoringGroup - runs on schedule, NOT during deployments
// =============================================================================
export const securityMonitorCheck = new MultiStepCheck("near-security-monitor", {
  name: "Admin Function Activity Alerts",
  group: scheduledMonitoringGroup,
  runtimeId: "2025.04",
  frequency: Frequency.EVERY_10M,
  code: {
    entrypoint: path.join(__dirname, "security-monitor.spec.ts"),
  },
})

// =============================================================================
// BrowserCheck: Web App E2E
// Tests all web application routes are functional:
// - Home page (/) redirects to verification
// - Verification landing page (/verification) renders correctly
// - Verification start page (/verification/start) is accessible
// - Citizens page (/citizens) shows verification records
// - Wallet selector modal appears when clicking connect
//
// NOTE: In deploymentChecksGroup - runs during Vercel deployments AND on schedule
// This is the ONLY check that should run during Vercel deployment checks.
//
// Note: Full wallet connection/signing flow is tested in local E2E tests.
// Cloud browsers have limitations with cross-tab wallet communication.
// =============================================================================
export const webAppE2ECheck = new BrowserCheck("citizens-house-e2e", {
  name: "Web App UI Flow (All Routes)",
  group: deploymentChecksGroup,
  frequency: Frequency.EVERY_30M,
  code: {
    entrypoint: path.join(__dirname, "webapp-e2e.spec.ts"),
  },
})
