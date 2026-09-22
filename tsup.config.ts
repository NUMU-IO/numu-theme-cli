import { defineConfig } from "tsup";

export default defineConfig({
  // index = `numu-theme`, numu = `numu` (apps). One package, one login.
  entry: ["src/index.ts", "src/numu.ts"],
  format: ["cjs"],
  dts: false,
  splitting: false,
  sourcemap: false,
  clean: true,
  target: "node18",
  banner: { js: "#!/usr/bin/env node" },
});
