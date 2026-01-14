import path from "path"
import { Frequency, MultiStepCheck, UrlAssertionBuilder, UrlMonitor } from "checkly/constructs"

new UrlMonitor("citizens-house-uptime", {
  name: "Citizens House Web App",
  frequency: Frequency.EVERY_10M,
  locations: ["us-east-1"],
  request: {
    url: "https://citizenshouse.org",
    followRedirects: true,
    assertions: [UrlAssertionBuilder.statusCode().lessThan(400)],
  },
  degradedResponseTime: 3000,
  maxResponseTime: 8000,
})

new MultiStepCheck("near-contract-health", {
  name: "NEAR Contract Health",
  runtimeId: "2025.04",
  frequency: Frequency.EVERY_10M,
  locations: ["us-east-1"],
  code: {
    entrypoint: path.join(__dirname, "near-contract.spec.ts"),
  },
  environmentVariables: [
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
  ],
})
