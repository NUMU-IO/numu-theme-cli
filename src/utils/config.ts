import * as fs from "fs";
import * as path from "path";
import * as os from "os";

/**
 * `~/.numurc` resolution. We honor `NUMU_HOME` when set so tests
 * (and CI environments with a sandboxed user dir) can isolate the
 * config without writing to the real user's home directory. Falls
 * back to `os.homedir()` for normal interactive use.
 *
 * Why this matters: on Windows, `os.homedir()` calls
 * `GetUserProfileDirectoryW` and ignores `USERPROFILE` env overrides,
 * so a test-time `process.env.USERPROFILE` redirect is silently
 * ignored. `NUMU_HOME` gives tests an explicit, honored override.
 */
function configHome(): string {
  const override = process.env.NUMU_HOME;
  if (override && override.length > 0) return override;
  return os.homedir();
}

function rcFile(): string {
  return path.join(configHome(), ".numurc");
}

export interface NuMuConfig {
  api_url: string;
  token?: string;
  store_id?: string;
}

/** Prod NUMU API root. The client appends nothing extra — callers hit
 *  `${api_url}/<resource>` — so the `/api/v1` suffix belongs here. */
const DEFAULT_API_URL = "https://numueg.app/api/v1";

/**
 * Warn (to stderr) when the resolved API host isn't a NUMU host. The bearer
 * token in `~/.numurc` is attached to authenticated commands, so a stray
 * `api_url` (a leftover `api.numu.io` from an old config, or a typo) would
 * ship that credential to a third party. localhost/loopback is allowed for
 * running against a local backend. stderr keeps it out of any command's
 * machine-readable stdout.
 */
function warnIfUntrustedHost(apiUrl: string): void {
  let host: string;
  try {
    host = new URL(apiUrl).hostname;
  } catch {
    return; // Malformed URL — the failing request will surface it on use.
  }
  const trusted =
    host === "numueg.app" ||
    host.endsWith(".numueg.app") ||
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1";
  if (!trusted) {
    process.stderr.write(
      `[numu-theme] Warning: API host "${host}" is not a *.numueg.app host — ` +
        `your ~/.numurc token will be sent to it. Set api_url to ` +
        `${DEFAULT_API_URL} (or re-run \`numu-theme login\`) if that's unexpected.\n`,
    );
  }
}

export function loadConfig(): NuMuConfig {
  const config: NuMuConfig = {
    api_url: process.env.NUMU_API_URL || DEFAULT_API_URL,
  };

  if (fs.existsSync(rcFile())) {
    try {
      const rc = JSON.parse(fs.readFileSync(rcFile(), "utf-8"));
      if (rc.token) config.token = rc.token;
      if (rc.api_url) config.api_url = rc.api_url;
      if (rc.store_id) config.store_id = rc.store_id;
    } catch {
      // Ignore — corrupt rc file is treated as missing.
    }
  }

  if (process.env.NUMU_TOKEN) config.token = process.env.NUMU_TOKEN;
  if (process.env.NUMU_STORE_ID) config.store_id = process.env.NUMU_STORE_ID;

  warnIfUntrustedHost(config.api_url);

  return config;
}

export function saveConfig(updates: Partial<NuMuConfig>): void {
  let existing: Record<string, unknown> = {};
  if (fs.existsSync(rcFile())) {
    try {
      existing = JSON.parse(fs.readFileSync(rcFile(), "utf-8"));
    } catch {
      // Treat as empty.
    }
  }
  const merged = { ...existing, ...updates };
  // 0o600 — owner read/write only. The token in this file is equivalent
  // to a session credential; default 0o644 (world-readable) would let any
  // local user steal it. fs.writeFileSync respects the mode flag on POSIX;
  // on Windows it's a no-op (Windows ACLs don't map cleanly).
  fs.writeFileSync(rcFile(), JSON.stringify(merged, null, 2), { mode: 0o600 });
  // If the file already existed with looser perms (e.g., from an older
  // CLI version), tighten them now.
  try {
    fs.chmodSync(rcFile(), 0o600);
  } catch {
    // Windows / non-POSIX: ignore.
  }
}
