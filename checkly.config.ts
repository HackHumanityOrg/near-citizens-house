import { defineConfig } from "checkly"
import { Frequency } from "checkly/constructs"

export default defineConfig({
  projectName: "NEAR Citizens House Monitoring",
  logicalId: "near-citizens-house-monitoring",
  checks: {
    activated: true,
    muted: false,
    runtimeId: "2025.04",
    frequency: Frequency.EVERY_10M,
    locations: ["us-east-1", "eu-central-1"],
    tags: ["near", "citizens-house"],
    checkMatch: "checkly/**/*.check.ts",
    ignoreDirectoriesMatch: ["node_modules", ".next", "dist"],
    browserChecks: {
      frequency: Frequency.EVERY_30M,
      testMatch: "checkly/__checks__/**/*-e2e.spec.ts",
    },
    multiStepChecks: {
      testMatch: "checkly/__checks__/**/!(*-e2e).spec.ts",
    },
  },
  cli: {
    runLocation: "us-east-1",
  },
})
