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
    },
  },
})
