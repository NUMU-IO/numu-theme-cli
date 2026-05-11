import { Command } from "commander";
import { loadConfig } from "../utils/config";
import { apiRequest } from "../utils/api";

interface BuildStatus {
  build_id: string;
  status: string;
  theme_id?: string | null;
  version_id?: string | null;
  theme_slug?: string | null;
  version?: string | null;
  bundle_url?: string | null;
  css_url?: string | null;
  checksum?: string | null;
  size_bytes?: number | null;
  error?: string | null;
  updated_at?: string | null;
}

interface VersionStatus {
  version_id: string;
  version_string?: string;
  status: string;
  bundle_url?: string | null;
  css_url?: string | null;
  size_bytes?: number | null;
  checksum?: string | null;
  build_log?: string | null;
}

interface Options {
  build?: string;
  version?: string;
  watch?: boolean;
  interval?: string;
}

/**
 * Poll a build (from `numu-theme push`) or marketplace version (from
 * `numu-theme submit`). Without `--watch`, prints once and exits. With
 * `--watch`, polls every `--interval` seconds (default 3) until the build
 * reaches a terminal state.
 */
export const statusCommand = new Command("status")
  .description("Poll the status of a theme build or marketplace version")
  .option("--build <build_id>", "Build ID returned by `numu-theme push`")
  .option(
    "--version <version_id>",
    "Marketplace version ID returned by `numu-theme submit`",
  )
  .option("-w, --watch", "Poll until the build reaches a terminal state")
  .option(
    "-i, --interval <seconds>",
    "Polling interval in seconds (with --watch)",
    "3",
  )
  .action(async (options: Options) => {
    const config = loadConfig();
    if (!config.token) {
      console.error("Not logged in. Run: numu-theme login");
      process.exit(1);
    }
    if (!options.build && !options.version) {
      console.error("Provide --build <id> or --version <id>");
      process.exit(1);
    }
    if (options.build && options.version) {
      console.error("Use one of --build or --version, not both");
      process.exit(1);
    }

    const intervalMs = Math.max(
      1000,
      Math.floor(parseFloat(options.interval || "3") * 1000),
    );

    const TERMINAL_BUILD = new Set([
      "complete",
      "completed",
      "failed",
      "error",
    ]);
    const TERMINAL_VERSION = new Set([
      "pending_review",
      "published",
      "rejected",
      "build_failed",
    ]);

    async function pollOnce(): Promise<{ done: boolean; failed: boolean }> {
      if (options.build) {
        const res = await apiRequest<BuildStatus>(
          "GET",
          `/themes/builds/${encodeURIComponent(options.build!)}`,
        );
        if (res.status === 404) {
          console.error(`Build ${options.build} not found`);
          return { done: true, failed: true };
        }
        if (res.status >= 300) {
          console.error(`HTTP ${res.status}: ${JSON.stringify(res.data)}`);
          return { done: true, failed: true };
        }
        const s = res.data;
        printBuild(s);
        const terminal = TERMINAL_BUILD.has(s.status);
        const failed = s.status === "failed" || s.status === "error";
        return { done: terminal, failed };
      }

      // --version path
      const res = await apiRequest<VersionStatus>(
        "GET",
        `/marketplace/developer/versions/${encodeURIComponent(options.version!)}/status`,
      );
      if (res.status === 404) {
        console.error(`Version ${options.version} not found`);
        return { done: true, failed: true };
      }
      if (res.status >= 300) {
        console.error(`HTTP ${res.status}: ${JSON.stringify(res.data)}`);
        return { done: true, failed: true };
      }
      const s = res.data;
      printVersion(s);
      const terminal = TERMINAL_VERSION.has(s.status);
      const failed = s.status === "rejected" || s.status === "build_failed";
      return { done: terminal, failed };
    }

    if (!options.watch) {
      const { failed } = await pollOnce();
      process.exit(failed ? 1 : 0);
    }

    // --watch loop
    while (true) {
      const { done, failed } = await pollOnce();
      if (done) {
        process.exit(failed ? 1 : 0);
      }
      await sleep(intervalMs);
    }
  });

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function printBuild(s: BuildStatus): void {
  console.log(`Build:      ${s.build_id}`);
  console.log(`Status:     ${s.status}`);
  if (s.version) console.log(`Version:    ${s.version}`);
  if (s.theme_slug) console.log(`Theme:      ${s.theme_slug}`);
  if (s.bundle_url) console.log(`Bundle:     ${s.bundle_url}`);
  if (s.css_url) console.log(`CSS:        ${s.css_url}`);
  if (s.size_bytes != null)
    console.log(`Size:       ${formatBytes(s.size_bytes)}`);
  if (s.checksum) console.log(`Checksum:   ${s.checksum}`);
  if (s.updated_at) console.log(`Updated:    ${s.updated_at}`);
  if (s.error) console.log(`\nError:\n${s.error}`);
  console.log("");
}

function printVersion(s: VersionStatus): void {
  console.log(`Version:    ${s.version_id}`);
  if (s.version_string) console.log(`Number:     ${s.version_string}`);
  console.log(`Status:     ${s.status}`);
  if (s.bundle_url) console.log(`Bundle:     ${s.bundle_url}`);
  if (s.css_url) console.log(`CSS:        ${s.css_url}`);
  if (s.size_bytes != null)
    console.log(`Size:       ${formatBytes(s.size_bytes)}`);
  if (s.checksum) console.log(`Checksum:   ${s.checksum}`);
  if (s.build_log) console.log(`\nBuild log:\n${s.build_log}`);
  console.log("");
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}
