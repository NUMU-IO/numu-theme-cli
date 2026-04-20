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
    } catch {}
  }

  if (process.env.NUMU_TOKEN) config.token = process.env.NUMU_TOKEN;
  if (process.env.NUMU_STORE_ID) config.store_id = process.env.NUMU_STORE_ID;

  return config;
}

export function saveConfig(updates: Partial<NuMuConfig>): void {
  let existing: Record<string, any> = {};
  if (fs.existsSync(RC_FILE)) {
    try { existing = JSON.parse(fs.readFileSync(RC_FILE, "utf-8")); } catch {}
  }
  const merged = { ...existing, ...updates };
  fs.writeFileSync(RC_FILE, JSON.stringify(merged, null, 2));
}
