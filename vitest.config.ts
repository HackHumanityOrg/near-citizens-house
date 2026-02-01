import { defineConfig } from "vitest/config"
import path from "path"

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["**/*.test.ts"],
    setupFiles: ["allure-vitest/setup"],
    reporters: [
      "default",
      [
        "allure-vitest/reporter",
        {
          resultsDir: path.resolve(__dirname, "allure-results"),
        },
      ],
    ],
    testTimeout: 30000, // 30s for network calls
    retry: 2, // Retry flaky network tests
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
      // Mock server-only to be a no-op in tests (it throws in non-RSC contexts)
      "server-only": path.resolve(__dirname, "./apps/citizens-house/lib/__tests__/__mocks__/server-only.ts"),
      // Mock posthog-js to prevent tests from sending real analytics events
      "posthog-js": path.resolve(__dirname, "./apps/citizens-house/lib/__tests__/__mocks__/posthog-js.ts"),
    },
  },
})
