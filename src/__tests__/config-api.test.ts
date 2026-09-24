import { describe, it, expect, vi, afterEach } from "vitest";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import type { AddressInfo } from "node:net";

import { loadConfig } from "../utils/config";
import { apiRequest } from "../utils/api";

let home = "";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  if (home) fs.rmSync(home, { recursive: true, force: true });
});

function stubHome(rc: object): void {
  home = fs.mkdtempSync(path.join(os.tmpdir(), "numu-config-"));
  fs.writeFileSync(path.join(home, ".numurc"), JSON.stringify(rc));
  vi.stubEnv("NUMU_HOME", home);
}

describe("loadConfig precedence", () => {
  it("prefers NUMU_API_URL and NUMU_TOKEN over ~/.numurc", () => {
    stubHome({ api_url: "http://localhost:8021", token: "rc-token" });
    vi.stubEnv("NUMU_API_URL", "https://numueg.app/api/v1");
    vi.stubEnv("NUMU_TOKEN", "env-token");
    const config = loadConfig();
    expect(config.api_url).toBe("https://numueg.app/api/v1");
    expect(config.token).toBe("env-token");
  });

  it("falls back to ~/.numurc when env is unset", () => {
    stubHome({ api_url: "http://localhost:8021" });
    vi.stubEnv("NUMU_API_URL", "");
    expect(loadConfig().api_url).toBe("http://localhost:8021");
  });
});

describe("apiRequest network errors", () => {
  it("prints one line and exits 1 when the API is unreachable", async () => {
    const server = http.createServer();
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    const { port } = server.address() as AddressInfo;
    await new Promise((r) => server.close(r));

    const apiUrl = `http://127.0.0.1:${port}`;
    stubHome({ api_url: apiUrl });
    vi.stubEnv("NUMU_API_URL", "");
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const exited = new Promise<number | undefined>((resolve) => {
      vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
        resolve(code);
      }) as never);
    });

    void apiRequest("GET", "/ping");
    expect(await exited).toBe(1);
    expect(error).toHaveBeenCalledWith(
      `✗ Cannot reach ${apiUrl}: connection refused. Check NUMU_API_URL or run numu login --api-url <url>.`,
    );
  });
});
