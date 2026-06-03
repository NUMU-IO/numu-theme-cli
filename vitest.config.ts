import { defineConfig, configDefaults } from "vitest/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// The contract matchers + helpers live in the sibling numu-theme-v3-tests/
// workspace. When it isn't checked out (e.g. standalone CI of this repo),
// the contract-driven validator suite can't load, so we skip it gracefully
// instead of failing the run. The unit suites (lint rules, etc.) still run.
const harnessRoot = path.resolve(__dirname, "../numu-theme-v3-tests");
const HARNESS_PRESENT = fs.existsSync(harnessRoot);
const harnessCoupledTests = ["src/__tests__/validator.test.ts"];
if (!HARNESS_PRESENT) {
  console.warn(
    `[vitest] numu-theme-v3-tests workspace not found — skipping contract suites: ${harnessCoupledTests.join(", ")}`,
  );
}

export default defineConfig({
  server: {
    fs: {
      allow: [path.resolve(__dirname, ".."), __dirname],
    },
  },
  test: {
    globals: true,
    environment: "node",
    include: ["src/__tests__/**/*.test.ts"],
    exclude: [
      ...configDefaults.exclude,
      ...(HARNESS_PRESENT ? [] : harnessCoupledTests),
    ],
    testTimeout: 30_000,
    setupFiles: [
      ...(HARNESS_PRESENT
        ? [path.resolve(harnessRoot, "tests/matchers/index.ts")]
        : []),
    ],
  },
  resolve: {
    alias: {
      "@numueg/theme-cli": path.resolve(__dirname, "src/index.ts"),
    },
  },
});
