import { defineConfig } from "vitest/config";

export default defineConfig({
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
  },
});
