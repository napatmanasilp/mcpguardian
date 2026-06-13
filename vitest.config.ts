import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": process.cwd(),
    },
  },
  test: {
    // Default test run excludes integration tests that need live MCP servers
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/tests/integration/**",
    ],
    // Increase timeout for scanner pipeline tests
    testTimeout: 10_000,
    // Use jsdom for component tests
    environment: "jsdom",
    // Setup files for testing-library matchers
    setupFiles: ["./vitest.setup.ts"],
  },
});
