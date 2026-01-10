import { defineConfig, devices } from "@playwright/test"

// Worker count configuration:
// - E2E_WORKERS env var: Explicit worker count (e.g., E2E_WORKERS=100)
// - CI: Defaults to 1 worker (can be overridden with E2E_WORKERS)
// - Local: Defaults to undefined (Playwright auto-detects based on CPU)
function getWorkerCount(): number | undefined {
  if (process.env.E2E_WORKERS) {
    return parseInt(process.env.E2E_WORKERS, 10)
  }
  if (process.env.CI) {
    return 1
  }
  return undefined
}

const isStressMode = process.env.E2E_STRESS === "true" || process.env.E2E_STRESS === "1"

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  // Global setup registers worker keys in batches
  // This avoids nonce collisions when workers start simultaneously
  globalSetup: require.resolve("./e2e/global-setup"),
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: getWorkerCount(),
  reporter: [["html"], ["allure-playwright"]],
  // Increase default timeout for wallet + contract operations
  // Mainnet contract storage can take up to 90s with polling
  timeout: 180000,
  use: {
    baseURL: "http://localhost:3000",
    trace: isStressMode ? "off" : "on-first-retry",
    screenshot: isStressMode ? "off" : "only-on-failure",
    video: isStressMode ? "off" : "on-first-retry",
    // Increase action timeout for slower external wallet UI
    actionTimeout: 15000,
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // Browser optimization flags for high parallelism
        launchOptions: {
          args: [
            "--disable-dev-shm-usage", // Use /tmp instead of /dev/shm (helps in Docker/limited memory)
            "--disable-gpu", // Disable GPU hardware acceleration
          ],
        },
      },
    },
  ],
  webServer: {
    command: "next build && next start -p 3000",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 180000, // Build takes longer than dev server startup
  },
})
