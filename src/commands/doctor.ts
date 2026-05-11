import { Command } from "commander";
import * as fs from "fs";
import * as path from "path";
import { loadConfig } from "../utils/config";
import { apiRequest } from "../utils/api";
import { validateTheme } from "../utils/validator";

/**
 * `numu-theme doctor` — single-command diagnostic for the 90% case.
 *
 * Checks, in order:
 *   1. Are we inside a NUMU theme directory? (theme.json + settings_schema.json)
 *   2. Does the theme pass the validator (semver, sections, .env, etc.)?
 *   3. Does src/main.tsx export a `mount` function?
 *   4. Has `numu-theme build` been run? (dist/theme.js + theme.css present)
 *   5. Is the CLI logged in? (~/.numurc has token + api_url)
 *   6. Is the configured API URL reachable, and is the token still valid?
 *   7. Is anything serving on the expected dev port (5173)?
 *
 * Each check prints a green / yellow / red status. Designed to be run
 * inside the theme directory before opening a support ticket.
 */
export const doctorCommand = new Command("doctor")
  .description("Diagnose common dev-loop problems (run inside a theme directory)")
  .option("-d, --dir <directory>", "Theme directory", ".")
  .option("-p, --port <port>", "Expected dev server port", "5173")
  .action(async (options: { dir: string; port: string }) => {
    let issues = 0;
    let warnings = 0;
    const themeDir = path.resolve(options.dir);

    function ok(line: string) {
      console.log(`  [32m✓[0m ${line}`);
    }
    function warn(line: string) {
      warnings += 1;
      console.log(`  [33m⚠[0m ${line}`);
    }
    function fail(line: string) {
      issues += 1;
      console.log(`  [31m✗[0m ${line}`);
    }

    // ── 1. Inside a theme directory ──
    console.log("\nProject");
    const themeJsonPath = path.join(themeDir, "theme.json");
    const settingsPath = path.join(themeDir, "settings_schema.json");
    if (!fs.existsSync(themeJsonPath)) {
      fail(`No theme.json found in ${themeDir}`);
      console.log(
        "    Run [36mnumu-theme init <name>[0m to scaffold a theme.",
      );
      process.exit(1);
    }
    ok(`Theme directory: ${themeDir}`);
    if (!fs.existsSync(settingsPath))
      warn("settings_schema.json missing — no global theme settings");
    else ok("settings_schema.json present");

    // ── 2. Theme contract ──
    console.log("\nContract");
    const result = validateTheme(themeDir);
    for (const w of result.warnings) warn(w);
    for (const e of result.errors) fail(e);
    if (result.valid && result.errors.length === 0)
      ok(`numu-theme check passes (${result.warnings.length} warning(s))`);

    // ── 3. mount() export ──
    console.log("\nBundle contract");
    const entryCandidates = [
      "src/main.tsx",
      "src/main.ts",
      "src/index.tsx",
      "src/index.ts",
    ];
    const entry = entryCandidates.find((p) =>
      fs.existsSync(path.join(themeDir, p)),
    );
    if (!entry) {
      fail(`No entry point found (expected one of: ${entryCandidates.join(", ")})`);
    } else {
      const src = fs.readFileSync(path.join(themeDir, entry), "utf-8");
      const exportsMount =
        /\bexport\s+(?:async\s+)?function\s+mount\b/.test(src) ||
        /\bexport\s+(?:const|let|var)\s+mount\b/.test(src) ||
        /\bexport\s*\{[^}]*\bmount\b[^}]*\}/.test(src);
      if (exportsMount) ok(`${entry} exports mount(el, props)`);
      else
        fail(
          `${entry} does NOT export mount(el, props) — BYOT host can't render this theme. ` +
            "See THEME_AUTHORING.md for the contract, or scaffold a fresh theme with `numu-theme init`.",
        );
    }

    // ── 3.5 Locale files (Phase 2.6) ──
    //
    // Theme locales live under `locales/<lang>.json` and are bundled
    // into the theme by the plugin's asset pipeline. The default locale
    // (en.default.json) is required so `useTranslation` always has a
    // baseline; other locales (ar.json, etc.) are optional but warned on
    // because MENA-first stores typically need at least Arabic.
    console.log("\nLocales");
    const localesDir = path.join(themeDir, "locales");
    if (!fs.existsSync(localesDir)) {
      warn(
        "locales/ directory not found — `useTranslation` will fall through to keys. " +
          "Add locales/en.default.json (required) and locales/ar.json (recommended for MENA stores).",
      );
    } else {
      const localeFiles = fs
        .readdirSync(localesDir)
        .filter((f) => f.endsWith(".json"));
      const hasDefault = localeFiles.some((f) => f.endsWith(".default.json"));
      if (!hasDefault) {
        fail(
          "No default locale file found in locales/ — useTranslation needs a *.default.json fallback. " +
            "Rename your primary locale to e.g. locales/en.default.json.",
        );
      } else {
        ok(`locales/ has ${localeFiles.length} file(s) including default`);
      }
      // Validate each locale parses
      for (const f of localeFiles) {
        try {
          JSON.parse(fs.readFileSync(path.join(localesDir, f), "utf-8"));
        } catch (err) {
          fail(`locales/${f} is not valid JSON: ${(err as Error).message}`);
        }
      }
    }

    // ── 3.6 Asset pipeline (Phase 2.6) ──
    //
    // Themes that reference assetUrl("foo.jpg") need a corresponding
    // file under assets/. We don't grep every source file (false-
    // positive heavy on dynamically-named assets) but we do make sure
    // the pipeline can find an assets directory at all when the build
    // copy step runs.
    console.log("\nAssets");
    const assetsDir = path.join(themeDir, "assets");
    if (!fs.existsSync(assetsDir)) {
      warn(
        "assets/ directory not found — assetUrl() helpers will fall back " +
          "to bare paths under /assets/. Create assets/ and put images, " +
          "fonts, and JSON fixtures there for the plugin to copy with " +
          "content-hashed filenames.",
      );
    } else {
      const count = fs.readdirSync(assetsDir).filter(
        (f) => !f.startsWith("."),
      ).length;
      if (count === 0) {
        warn("assets/ exists but is empty");
      } else {
        ok(`assets/ contains ${count} file(s)/folder(s)`);
      }
    }

    // ── 3.7 Theme.json preset references (Phase 2.6) ──
    //
    // Every section type referenced from theme.json's `presets[*].sections`
    // must exist as a component AND a schema. A typo'd type here means the
    // customizer's "Add section" dialog shows ghost entries that crash on
    // selection.
    console.log("\nPresets");
    try {
      const themeJson = JSON.parse(
        fs.readFileSync(themeJsonPath, "utf-8"),
      ) as { presets?: Record<string, unknown> };
      const presets = themeJson.presets ?? {};
      const sectionsDir = path.join(themeDir, "src", "sections");
      const schemaDir = path.join(themeDir, "schemas", "sections");
      const componentNames = fs.existsSync(sectionsDir)
        ? new Set(
            fs
              .readdirSync(sectionsDir)
              .filter((f) => /\.(tsx|ts|jsx|js)$/.test(f))
              .map((f) => path.basename(f, path.extname(f)).toLowerCase()),
          )
        : new Set<string>();
      const schemaNames = fs.existsSync(schemaDir)
        ? new Set(
            fs
              .readdirSync(schemaDir)
              .filter((f) => f.endsWith(".json"))
              .map((f) => path.basename(f, ".json").toLowerCase()),
          )
        : new Set<string>();
      let missingRefs = 0;
      for (const [presetName, presetVal] of Object.entries(presets)) {
        const sections = (
          (presetVal as { sections?: Record<string, { type?: string }> })
            .sections ?? {}
        );
        for (const [, sec] of Object.entries(sections)) {
          const t = (sec?.type || "").toLowerCase();
          if (!t) continue;
          if (!componentNames.has(t)) {
            fail(
              `Preset "${presetName}" references section type "${t}" but ` +
                `src/sections/${t}.tsx (or .jsx/.ts) is missing.`,
            );
            missingRefs += 1;
          } else if (!schemaNames.has(t)) {
            warn(
              `Preset "${presetName}" references section type "${t}" but ` +
                `schemas/sections/${t}.json is missing — customizer will warn on selection.`,
            );
          }
        }
      }
      if (Object.keys(presets).length === 0) {
        warn("theme.json has no presets — merchants start with an empty page");
      } else if (missingRefs === 0) {
        ok(
          `${Object.keys(presets).length} preset(s); all section refs resolve`,
        );
      }
    } catch (err) {
      warn(`Could not parse theme.json presets: ${(err as Error).message}`);
    }

    // ── 4. Build artifacts ──
    console.log("\nBuild");
    const distJs = path.join(themeDir, "dist", "theme.js");
    const distCss = path.join(themeDir, "dist", "theme.css");
    if (!fs.existsSync(distJs)) {
      warn("dist/theme.js not found — run `numu-theme build` first");
    } else {
      const stat = fs.statSync(distJs);
      ok(`dist/theme.js (${(stat.size / 1024).toFixed(1)} KB)`);
      if (stat.size > 2 * 1024 * 1024)
        warn("Bundle exceeds 2 MB — marketplace will reject");
    }
    if (!fs.existsSync(distCss)) {
      warn(
        "dist/theme.css not found — the plugin should copy styles.css; check that styles.css exists",
      );
    } else {
      ok("dist/theme.css present");
    }

    // ── 5. CLI auth ──
    console.log("\nAuth");
    const config = loadConfig();
    if (!config.token) {
      warn("Not logged in — run `numu-theme login --api-url <url>` to enable push/submit");
    } else {
      ok(`Token loaded (${config.token.slice(0, 12)}…)`);
    }
    if (!config.api_url) {
      warn("No api_url configured — run `numu-theme login --api-url <url>`");
    } else {
      ok(`API URL: ${config.api_url}`);
    }

    // ── 6. Backend reachability + token validity ──
    if (config.token && config.api_url) {
      console.log("\nBackend");
      try {
        // Use /auth/me — a stable authenticated endpoint that returns the
        // current user. 200 = reachable + token valid. 401 = token
        // expired. 404 = the API URL is wrong (mistyped /api/v1, etc.).
        const res = await apiRequest("GET", "/auth/me");
        if (res.status === 200) {
          ok("Backend reachable, token valid");
        } else if (res.status === 401) {
          fail("Token expired — run `numu-theme login` again");
        } else if (res.status === 404) {
          warn(
            `API URL may be wrong (HTTP 404 on /auth/me). Confirm api_url in ~/.numurc points to the /api/v1 prefix.`,
          );
        } else {
          warn(`Backend returned HTTP ${res.status}`);
        }
      } catch (err) {
        fail(`Cannot reach ${config.api_url}: ${(err as Error).message}`);
      }
    }

    // ── 7. Dev port ──
    console.log("\nDev server");
    const port = parseInt(options.port, 10);
    try {
      const probe = await fetch(`http://localhost:${port}/theme.json`, {
        signal: AbortSignal.timeout(1500),
      }).catch(() => null);
      if (!probe) {
        warn(
          `Nothing serving on http://localhost:${port} — run \`numu-theme dev\` in another terminal to enable dev-mode connect`,
        );
      } else if (probe.ok) {
        ok(`Dev server is up on :${port} and serving theme.json`);
      } else {
        warn(
          `Port ${port} responds but didn't return theme.json (HTTP ${probe.status})`,
        );
      }
    } catch (err) {
      warn(`Dev port check failed: ${(err as Error).message}`);
    }

    // ── Summary ──
    console.log("");
    if (issues === 0 && warnings === 0) {
      console.log("[32m✓ All checks passed.[0m");
    } else if (issues === 0) {
      console.log(
        `[33m⚠ ${warnings} warning(s) — theme should still work.[0m`,
      );
    } else {
      console.log(
        `[31m✗ ${issues} error(s), ${warnings} warning(s).[0m`,
      );
      process.exit(1);
    }
  });
