import { Command } from "commander";
import { execSync } from "child_process";
import { existsSync } from "fs";
import { createRequire } from "module";
import * as path from "path";
import { pathToFileURL } from "url";

/**
 * `numu-theme verify` — behavioral render check (theme-enforcement Phase 2).
 *
 * Server-renders every required template through the built theme's
 * `createApp` against representative fixture data and fails on any template
 * that throws or renders empty. This catches the runtime bugs the structural
 * gate (`build`/`check`) can't: a section reading an undefined setting, an SDK
 * hook used outside its provider, a template producing no output.
 *
 * It runs the harness from the THEME's own installed `@numueg/theme-sdk`
 * (`/verify` entry), so the fixtures + contract match what the theme built
 * against — and loads the theme's `dist/theme.server.js` (its node_modules
 * satisfy the bundle's react / react-dom / SDK externals).
 */

// Keep a REAL dynamic import in the CJS build — esbuild would otherwise
// rewrite `import()` to `require()` and choke on the ESM theme bundle.
const dynamicImport = new Function("u", "return import(u)") as (
  u: string,
) => Promise<Record<string, unknown>>;

interface TemplateRenderResult {
  template: string;
  ok: boolean;
  htmlLength: number;
  error?: string;
}
interface VerifyRenderResult {
  ok: boolean;
  results: TemplateRenderResult[];
}

export const verifyCommand = new Command("verify")
  .description(
    "Server-render every template against fixtures to catch runtime crashes",
  )
  .option("-d, --dir <directory>", "Theme directory", ".")
  .option("--locale <code>", "Render under a locale (e.g. `ar` for RTL)")
  .option("--no-build", "Verify the existing dist/ without rebuilding")
  .action(
    async (options: { dir: string; locale?: string; build?: boolean }) => {
      const dir = path.resolve(process.cwd(), options.dir);

      if (options.build !== false) {
        console.log("Building theme (SSR bundle)…");
        try {
          execSync("npx vite build", { cwd: dir, stdio: "inherit" });
        } catch {
          console.error("Build failed");
          process.exit(1);
        }
      }

      const serverBundle = path.join(dir, "dist", "theme.server.js");
      if (!existsSync(serverBundle)) {
        console.error(
          "No dist/theme.server.js — this theme is client-only and can't be " +
            "render-verified. Export `createApp` via defineThemeEntry() and " +
            "build with federate:true (SDK >= 0.3).",
        );
        process.exit(1);
      }

      // Resolve the harness from the theme's installed SDK so the fixtures +
      // contract match what the theme built against.
      const requireFromTheme = createRequire(path.join(dir, "package.json"));
      let harness: {
        verifyThemeRender: (
          mod: unknown,
          opts?: { locale?: string },
        ) => Promise<VerifyRenderResult>;
      };
      try {
        const verifyEntry = requireFromTheme.resolve("@numueg/theme-sdk/verify");
        harness = (await dynamicImport(
          pathToFileURL(verifyEntry).href,
        )) as unknown as typeof harness;
      } catch {
        console.error(
          "This theme's @numueg/theme-sdk has no `/verify` entry — upgrade " +
            "@numueg/theme-sdk to a version that ships the render harness.",
        );
        process.exit(1);
      }

      let serverModule: Record<string, unknown>;
      try {
        serverModule = await dynamicImport(pathToFileURL(serverBundle).href);
      } catch (e) {
        console.error(
          "Failed to load dist/theme.server.js:",
          e instanceof Error ? e.message : String(e),
        );
        process.exit(1);
      }
      const def = serverModule.default as Record<string, unknown> | undefined;
      const mod = {
        createApp: serverModule.createApp ?? def?.createApp,
      };

      const result = await harness.verifyThemeRender(mod, {
        locale: options.locale,
      });

      console.log("\nRender verification:");
      for (const r of result.results) {
        const mark = r.ok ? "✓" : "✘";
        console.log(
          `  ${mark} ${r.template}${r.ok ? ` (${r.htmlLength} chars)` : ""}`,
        );
        if (!r.ok && r.error) {
          console.log(`      ${String(r.error).split("\n")[0]}`);
        }
      }

      if (!result.ok) {
        console.error(
          "\n✘ Render verification failed — fix the crashing templates above.",
        );
        process.exit(1);
      }
      console.log("\n✓ All templates render against fixture data.");
    },
  );
