import { Command } from "commander";
import { execSync } from "child_process";
import { validateTheme } from "../utils/validator";

export const checkCommand = new Command("check")
  .description("Validate theme schemas and structure")
  .option("-d, --dir <directory>", "Theme directory", ".")
  .option(
    "--lighthouse",
    "Run a Lighthouse audit (performance + accessibility) — needs --url",
  )
  .option(
    "--url <url>",
    "URL of the built theme on a seeded store to audit (e.g. http://localhost:3100/<store>)",
  )
  .option("--perf <score>", "Minimum Lighthouse performance score (0-100)", "60")
  .option(
    "--a11y <score>",
    "Minimum Lighthouse accessibility score (0-100)",
    "90",
  )
  .option(
    "--strict",
    "Exit non-zero when below thresholds (default: soft gate — report only)",
  )
  .action(
    async (options: {
      dir: string;
      lighthouse?: boolean;
      url?: string;
      perf: string;
      a11y: string;
      strict?: boolean;
    }) => {
      console.log("Validating theme...");
      const result = validateTheme(options.dir);

      if (result.warnings.length > 0) {
        console.log("\nWarnings:");
        result.warnings.forEach((w) => console.log(`  ⚠ ${w}`));
      }

      if (result.errors.length > 0) {
        console.log("\nErrors:");
        result.errors.forEach((e) => console.log(`  ✗ ${e}`));
        console.log(`\nValidation failed with ${result.errors.length} error(s)`);
        process.exit(1);
      }

      console.log(`\n✓ Theme is valid (${result.warnings.length} warning(s))`);

      if (options.lighthouse) {
        runLighthouse(options);
      }
    },
  );

/**
 * Lighthouse perf/a11y gate (Phase 5.3). Shells out to `lighthouse` via npx
 * so the CLI carries no heavy dependency. Soft by default: reports scores and
 * only fails the command under `--strict`. If Lighthouse/Chrome isn't
 * available it soft-skips rather than failing the whole `check`.
 *
 * Shopify's Theme Store bar: Performance ≥ 60, Accessibility ≥ 90.
 */
function runLighthouse(options: {
  url?: string;
  perf: string;
  a11y: string;
  strict?: boolean;
}): void {
  if (!options.url) {
    console.error(
      "\n✘ --lighthouse requires --url <url> (a built theme on a seeded store).",
    );
    process.exit(1);
  }
  const perfMin = parseFloat(options.perf);
  const a11yMin = parseFloat(options.a11y);
  console.log(`\nRunning Lighthouse against ${options.url} ...`);

  let raw: string;
  try {
    raw = execSync(
      `npx --yes lighthouse "${options.url}" ` +
        `--output=json --output-path=stdout ` +
        `--only-categories=performance,accessibility ` +
        `--chrome-flags="--headless=new --no-sandbox --disable-gpu" ` +
        `--quiet --no-enable-error-reporting`,
      { encoding: "utf-8", maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "ignore"] },
    );
  } catch (e) {
    console.warn(
      "\n⚠ Could not run Lighthouse (install it: `npm i -g lighthouse`, and ensure Chrome is available). Soft-skipping.",
    );
    console.warn(`   ${String((e as Error).message).split("\n")[0]}`);
    return;
  }

  let report: { categories?: Record<string, { score?: number }> };
  try {
    report = JSON.parse(raw);
  } catch {
    console.warn("\n⚠ Lighthouse output was not parseable JSON; skipping gate.");
    return;
  }

  const perf = Math.round((report.categories?.performance?.score ?? 0) * 100);
  const a11y = Math.round((report.categories?.accessibility?.score ?? 0) * 100);
  console.log(`  Performance:   ${perf}  (min ${perfMin})`);
  console.log(`  Accessibility: ${a11y}  (min ${a11yMin})`);

  const failed = perf < perfMin || a11y < a11yMin;
  if (!failed) {
    console.log("✓ Lighthouse thresholds met.");
    return;
  }
  const msg = `Lighthouse below threshold (Perf ${perf}/${perfMin}, A11y ${a11y}/${a11yMin}).`;
  if (options.strict) {
    console.error(`✘ ${msg}`);
    process.exit(1);
  }
  console.warn(`⚠ ${msg}  (soft gate — pass --strict to enforce.)`);
}
