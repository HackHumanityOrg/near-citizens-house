import { defineConfig } from "vitest/config"
import path from "path"

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["**/*.test.ts"],
    passWithNoTests: true,
    setupFiles: ["allure-vitest/setup"],
    reporters: [
      "default",
      [
        "allure-vitest/reporter",
        {
          resultsDir: path.resolve(__dirname, "../../allure-results"),
        },
      ],
    ],
    testTimeout: 30000,
    retry: 2,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
      "@near-citizens/ui": path.resolve(__dirname, "./components/ui"),
    },
  },
})
