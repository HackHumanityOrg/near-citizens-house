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

// Environment variables for contract checks
const contractEnvVars = [
  {
    key: "NEAR_CONTRACT_ID",
    value: process.env.NEXT_PUBLIC_NEAR_VERIFICATION_CONTRACT ?? "verification-v1.hh-testinprod.near",
  },
  {
    key: "NEAR_BACKEND_WALLET",
    value: process.env.NEAR_ACCOUNT_ID ?? "hh-testinprod.near",
  },
  {
    key: "NEAR_RPC_URL",
    value: process.env.NEAR_RPC_URL ?? "https://rpc.mainnet.fastnear.com",
  },
  {
    key: "NEARBLOCKS_API_URL",
    value: process.env.NEARBLOCKS_API_URL ?? "https://api.nearblocks.io",
  },
]

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
// =============================================================================
const rpcUrl = process.env.NEAR_RPC_URL ?? "https://rpc.mainnet.fastnear.com"

export const rpcHealthCheck = new ApiCheck("near-rpc-health", {
  name: "NEAR RPC Connectivity",
  group: monitoringGroup,
  frequency: Frequency.EVERY_5M,
  degradedResponseTime: 2000,
  maxResponseTime: 5000,
  request: {
    method: "POST",
    url: rpcUrl,
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
  environmentVariables: contractEnvVars,
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
  environmentVariables: contractEnvVars,
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
  environmentVariables: contractEnvVars,
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
