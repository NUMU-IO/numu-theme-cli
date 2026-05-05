import * as fs from "fs";
import * as path from "path";
import * as os from "os";

const RC_FILE = path.join(os.homedir(), ".numurc");

export interface NuMuConfig {
  api_url: string;
  token?: string;
  store_id?: string;
}

export function loadConfig(): NuMuConfig {
  const config: NuMuConfig = {
    api_url: process.env.NUMU_API_URL || "https://api.numu.io/api/v1",
  };

  if (fs.existsSync(RC_FILE)) {
    try {
      const rc = JSON.parse(fs.readFileSync(RC_FILE, "utf-8"));
      if (rc.token) config.token = rc.token;
      if (rc.api_url) config.api_url = rc.api_url;
      if (rc.store_id) config.store_id = rc.store_id;
    } catch {
      // Ignore — corrupt rc file is treated as missing.
    }
  }

  if (process.env.NUMU_TOKEN) config.token = process.env.NUMU_TOKEN;
  if (process.env.NUMU_STORE_ID) config.store_id = process.env.NUMU_STORE_ID;

  return config;
}

export function saveConfig(updates: Partial<NuMuConfig>): void {
  let existing: Record<string, unknown> = {};
  if (fs.existsSync(RC_FILE)) {
    try {
      existing = JSON.parse(fs.readFileSync(RC_FILE, "utf-8"));
    } catch {
      // Treat as empty.
    }
  }
  const merged = { ...existing, ...updates };
  // 0o600 — owner read/write only. The token in this file is equivalent
  // to a session credential; default 0o644 (world-readable) would let any
  // local user steal it. fs.writeFileSync respects the mode flag on POSIX;
  // on Windows it's a no-op (Windows ACLs don't map cleanly).
  fs.writeFileSync(RC_FILE, JSON.stringify(merged, null, 2), { mode: 0o600 });
  // If the file already existed with looser perms (e.g., from an older
  // CLI version), tighten them now.
  try {
    fs.chmodSync(RC_FILE, 0o600);
  } catch {
    // Windows / non-POSIX: ignore.
  }
}
