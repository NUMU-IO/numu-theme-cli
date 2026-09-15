/**
 * `doctor`'s preset check used to iterate the `presets` object itself
 * (`templates`, `section_groups`), whose values have no `sections` — so it
 * visited 0 sections and printed "all section refs resolve" for any theme.
 * Auth, backend, and dev-port probes are stubbed: this test never hits the
 * network.
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

vi.mock("../utils/config", () => ({ loadConfig: () => ({}) }));
vi.mock("../utils/api", () => ({ apiRequest: vi.fn() }));

import { doctorCommand } from "../commands/doctor";

let dir = "";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("doctor presets", () => {
  it("resolves section refs in templates and section_groups (array presets)", async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "numu-doctor-"));
    fs.writeFileSync(
      path.join(dir, "theme.json"),
      JSON.stringify({
        name: "t",
        version: "0.1.0",
        presets: {
          templates: { home: { sections: [{ type: "hero" }] } },
          section_groups: { header: { sections: [{ type: "header" }] } },
        },
      }),
    );
    fs.mkdirSync(path.join(dir, "src/sections"), { recursive: true });
    fs.writeFileSync(path.join(dir, "src/sections/hero.tsx"), "");

    vi.stubGlobal("fetch", () => Promise.reject(new Error("offline")));
    const exit = vi.spyOn(process, "exit").mockImplementation((() => {}) as never);
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    await doctorCommand.parseAsync(["-d", dir], { from: "user" });

    const out = log.mock.calls.map((c) => c.join(" ")).join("\n");
    expect(out).toContain(
      'Preset "header" references section type "header" but src/sections/header.tsx',
    );
    expect(out).toContain('Preset "home" references section type "hero" but schemas/sections/hero.json');
    expect(out).not.toContain("all resolve");
    expect(exit).toHaveBeenCalledWith(1);
  });
});
