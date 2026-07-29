// Root Vitest config: runs every package's headless `*.test.ts` in one pass.
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: [
      "packages/*/src/**/*.test.ts",
      "packages/*/build/**/*.test.ts",
      "tests/integration/**/*.test.ts",
    ],
    exclude: ["**/node_modules/**", "**/dist/**"],
    environment: "node",
  },
});
