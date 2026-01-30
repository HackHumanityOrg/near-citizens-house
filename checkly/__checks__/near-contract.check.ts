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

// Shared configuration via CheckGroup
// Allowed regions: eu-central-1, us-east-1, ap-southeast-1, ap-southeast-2
const monitoringGroup = new CheckGroupV2("citizens-house-monitoring-group", {
  name: "Citizens House Monitoring",
  activated: true,
  muted: false,
  locations: ["us-east-1", "eu-central-1"],
  tags: ["near", "citizens-house"],
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
// Note: UrlMonitor doesn't support retry strategies, so it's not in the group
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
// Note: API checks require URL at deploy time, uses NEAR_RPC_URL env var or default
// =============================================================================
export const rpcHealthCheck = new ApiCheck("near-rpc-health", {
  name: "NEAR RPC Connectivity",
  group: monitoringGroup,
  frequency: Frequency.EVERY_5M,
  degradedResponseTime: 2000,
  maxResponseTime: 5000,
  request: {
    method: "POST",
    url: "{{NEAR_RPC_URL}}",
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
// =============================================================================
export const contractStateCheck = new MultiStepCheck("near-contract-state", {
  name: "Contract State (Wallet & Paused Status)",
  group: monitoringGroup,
  runtimeId: "2025.04",
  frequency: Frequency.EVERY_10M,
  code: {
    entrypoint: path.join(__dirname, "contract-state.spec.ts"),
  },
})

// =============================================================================
// MultiStepCheck: Verification Activity
// =============================================================================
export const verificationActivityCheck = new MultiStepCheck("near-verification-activity", {
  name: "Verification Transactions & Failures",
  group: monitoringGroup,
  runtimeId: "2025.04",
  frequency: Frequency.EVERY_10M,
  code: {
    entrypoint: path.join(__dirname, "verification-activity.spec.ts"),
  },
})

// =============================================================================
// MultiStepCheck: Security Monitor (admin method calls)
// =============================================================================
export const securityMonitorCheck = new MultiStepCheck("near-security-monitor", {
  name: "Admin Function Activity Alerts",
  group: monitoringGroup,
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
// Note: Full wallet connection/signing flow is tested in local E2E tests.
// Cloud browsers have limitations with cross-tab wallet communication.
// =============================================================================
export const webAppE2ECheck = new BrowserCheck("citizens-house-e2e", {
  name: "Web App UI Flow (All Routes)",
  group: monitoringGroup,
  frequency: Frequency.EVERY_30M,
  code: {
    entrypoint: path.join(__dirname, "webapp-e2e.spec.ts"),
  },
})
