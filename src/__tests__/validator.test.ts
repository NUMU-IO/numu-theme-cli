/**
 * CLI validateTheme() regressions — T041–T050 from tasks.md.
 *
 * Asserts each rule fires (negative) and that a clean theme passes
 * (positive). Severity matches what `validator.ts` actually does, NOT
 * what the spec's FR-002 list said — discrepancies are recorded in the
 * contract-registry caveat fields. See:
 *
 *   - rule 5 (settings_schema presence) → CLI emits WARNING (spec said error)
 *   - rule 8 (sdk in deps)              → CLI emits WARNING (spec said error)
 *   - rule 10 (presets)                 → CLI emits WARNING
 *
 * Those three are documented in the registry with the matching
 * severity. The "negative" test for each asserts that the rule shows
 * up in `warnings` rather than `errors`.
 */

import { describe, it, expect, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";

import { validateTheme } from "../utils/validator";
import {
  createSandbox,
  type SandboxHandle,
} from "../../../numu-theme-v3-tests/tests/helpers/tmp";
import { scaffoldValidTheme } from "../../../numu-theme-v3-tests/tests/helpers/scaffold";
import {
  CLI_VALIDATOR_THEME_JSON_EXISTS,
  CLI_VALIDATOR_THEME_JSON_PARSEABLE,
  CLI_VALIDATOR_REQUIRED_FIELDS_NAME,
  CLI_VALIDATOR_REQUIRED_FIELDS_VERSION,
  CLI_VALIDATOR_REQUIRED_FIELDS_AUTHOR,
  CLI_VALIDATOR_SEMVER,
  CLI_VALIDATOR_SETTINGS_SCHEMA_PRESENCE,
  CLI_VALIDATOR_SETTINGS_SCHEMA_JSON,
  CLI_VALIDATOR_SECTIONS_DIR_NON_EMPTY,
  CLI_VALIDATOR_SECTION_REGISTRY_SCHEMA_WITHOUT_COMPONENT,
  CLI_VALIDATOR_SECTION_REGISTRY_COMPONENT_WITHOUT_SCHEMA,
  CLI_VALIDATOR_SDK_IN_DEPS,
  CLI_VALIDATOR_NO_ENV_FILES,
  CLI_VALIDATOR_PRESETS_WARNING,
} from "../../../numu-theme-v3-tests/tests/contract-registry";

let activeSandbox: SandboxHandle | null = null;
async function freshThemeDir(): Promise<string> {
  if (activeSandbox) await activeSandbox.cleanup();
  activeSandbox = await createSandbox();
  return scaffoldValidTheme(activeSandbox.cwd);
}
afterEach(async () => {
  if (activeSandbox) {
    await activeSandbox.cleanup();
    activeSandbox = null;
  }
});

async function patchThemeJson(themeDir: string, mutator: (obj: Record<string, unknown>) => void) {
  const fp = path.join(themeDir, "theme.json");
  const obj = JSON.parse(await fs.readFile(fp, "utf-8"));
  mutator(obj);
  await fs.writeFile(fp, JSON.stringify(obj, null, 2), "utf-8");
}

/* ─── T041 cli/validator-theme-json-exists ─────────────────────────────────── */

describe("cli/validator-theme-json-exists", () => {
  it("negative: missing theme.json → errors contain the missing-theme.json message", async () => {
    const themeDir = await freshThemeDir();
    await fs.rm(path.join(themeDir, "theme.json"));
    const result = validateTheme(themeDir);
    expect(result.valid).toBe(false);
    const matched = result.errors.filter((e) => /Missing theme\.json/.test(e));
    expect(matched).toFailContractClause(CLI_VALIDATOR_THEME_JSON_EXISTS.id, {
      observed: "theme.json missing",
      expected: "theme.json present at theme root",
    });
  });

  it("positive: theme.json present → no missing-theme.json error", async () => {
    const themeDir = await freshThemeDir();
    const result = validateTheme(themeDir);
    expect(result.errors.filter((e) => /Missing theme\.json/.test(e))).toEqual([]);
  });
});

/* ─── T042 cli/validator-theme-json-parseable ──────────────────────────────── */

describe("cli/validator-theme-json-parseable", () => {
  it("negative: invalid JSON in theme.json → 'not valid JSON' error", async () => {
    const themeDir = await freshThemeDir();
    await fs.writeFile(path.join(themeDir, "theme.json"), "{ this is not json", "utf-8");
    const result = validateTheme(themeDir);
    expect(result.valid).toBe(false);
    const matched = result.errors.filter((e) => /not valid JSON/.test(e));
    expect(matched).toFailContractClause(CLI_VALIDATOR_THEME_JSON_PARSEABLE.id, {
      observed: "theme.json contains unparseable text",
      expected: "theme.json parses as JSON",
    });
  });

  it("positive: well-formed theme.json → no parse error", async () => {
    const themeDir = await freshThemeDir();
    const result = validateTheme(themeDir);
    expect(result.errors.filter((e) => /not valid JSON/.test(e))).toEqual([]);
  });
});

/* ─── T043 cli/validator-required-field-{name,version,author} ──────────────── */

describe("cli/validator-required-field-name", () => {
  it("negative: theme.json missing name → 'missing required field: name'", async () => {
    const themeDir = await freshThemeDir();
    await patchThemeJson(themeDir, (o) => delete o.name);
    const result = validateTheme(themeDir);
    const matched = result.errors.filter((e) => /missing required field: name/.test(e));
    expect(matched).toFailContractClause(CLI_VALIDATOR_REQUIRED_FIELDS_NAME.id, {
      observed: "theme.json has no `name`",
      expected: "theme.json contains `name`",
    });
  });

  it("positive: theme.json with name → no missing-name error", async () => {
    const themeDir = await freshThemeDir();
    const result = validateTheme(themeDir);
    expect(result.errors.filter((e) => /missing required field: name/.test(e))).toEqual([]);
  });
});

describe("cli/validator-required-field-version", () => {
  it("negative: theme.json missing version → 'missing required field: version'", async () => {
    const themeDir = await freshThemeDir();
    await patchThemeJson(themeDir, (o) => delete o.version);
    const result = validateTheme(themeDir);
    const matched = result.errors.filter((e) => /missing required field: version/.test(e));
    expect(matched).toFailContractClause(CLI_VALIDATOR_REQUIRED_FIELDS_VERSION.id, {
      observed: "theme.json has no `version`",
      expected: "theme.json contains `version`",
    });
  });

  it("positive: theme.json with version → no missing-version error", async () => {
    const themeDir = await freshThemeDir();
    const result = validateTheme(themeDir);
    expect(result.errors.filter((e) => /missing required field: version/.test(e))).toEqual([]);
  });
});

describe("cli/validator-required-field-author", () => {
  it("negative: theme.json missing author → 'missing required field: author' (cites §6e-4 drift with plugin)", async () => {
    const themeDir = await freshThemeDir();
    // scaffoldValidTheme writes author in package.json, but theme.json
    // by default doesn't have it. The CLI checks theme.json.author.
    await patchThemeJson(themeDir, (o) => delete o.author);
    const result = validateTheme(themeDir);
    const matched = result.errors.filter((e) => /missing required field: author/.test(e));
    expect(matched).toFailContractClause(CLI_VALIDATOR_REQUIRED_FIELDS_AUTHOR.id, {
      observed: "theme.json has no `author`",
      expected: "theme.json contains `author` (CLI-only; plugin ignores) — §6e-4",
    });
  });

  it("positive: theme.json with author → no missing-author error", async () => {
    const themeDir = await freshThemeDir();
    await patchThemeJson(themeDir, (o) => {
      o.author = "Test Author <test@example.test>";
    });
    const result = validateTheme(themeDir);
    expect(result.errors.filter((e) => /missing required field: author/.test(e))).toEqual([]);
  });
});

/* ─── T044 cli/validator-semver ────────────────────────────────────────────── */

describe("cli/validator-semver", () => {
  it("negative: version '1.0' (not semver) → 'not valid semver' error", async () => {
    const themeDir = await freshThemeDir();
    await patchThemeJson(themeDir, (o) => {
      o.version = "1.0";
    });
    const result = validateTheme(themeDir);
    const matched = result.errors.filter((e) => /not valid semver/.test(e));
    expect(matched).toFailContractClause(CLI_VALIDATOR_SEMVER.id, {
      observed: "1.0",
      expected: "valid semver per node-semver",
    });
  });

  it("positive: '1.0.0' is valid semver", async () => {
    const themeDir = await freshThemeDir();
    const result = validateTheme(themeDir);
    expect(result.errors.filter((e) => /not valid semver/.test(e))).toEqual([]);
  });
});

/* ─── T045 cli/validator-settings-schema-presence & json ───────────────────── */

describe("cli/validator-settings-schema-presence", () => {
  it("negative: missing settings_schema.json → WARNING (not error — per source code)", async () => {
    const themeDir = await freshThemeDir();
    await fs.rm(path.join(themeDir, "settings_schema.json"));
    const result = validateTheme(themeDir);
    const inWarnings = result.warnings.filter((w) => /Missing settings_schema\.json/.test(w));
    const inErrors = result.errors.filter((e) => /Missing settings_schema\.json/.test(e));
    expect(inWarnings).toFailContractClause(CLI_VALIDATOR_SETTINGS_SCHEMA_PRESENCE.id, {
      observed: `errors=${inErrors.length}, warnings=${inWarnings.length}`,
      expected: "missing settings_schema.json appears in warnings (not errors)",
    });
    expect(inErrors).toEqual([]);
  });

  it("positive: settings_schema.json present → no warning emitted", async () => {
    const themeDir = await freshThemeDir();
    const result = validateTheme(themeDir);
    expect(result.warnings.filter((w) => /Missing settings_schema\.json/.test(w))).toEqual([]);
  });
});

describe("cli/validator-settings-schema-json", () => {
  it("negative: invalid JSON in settings_schema.json → ERROR", async () => {
    const themeDir = await freshThemeDir();
    await fs.writeFile(path.join(themeDir, "settings_schema.json"), "{ broken", "utf-8");
    const result = validateTheme(themeDir);
    const matched = result.errors.filter((e) => /settings_schema\.json is not valid JSON/.test(e));
    expect(matched).toFailContractClause(CLI_VALIDATOR_SETTINGS_SCHEMA_JSON.id, {
      observed: "settings_schema.json contains unparseable text",
      expected: "settings_schema.json parses as JSON",
    });
  });

  it("positive: valid JSON in settings_schema.json → no parse error", async () => {
    const themeDir = await freshThemeDir();
    const result = validateTheme(themeDir);
    expect(result.errors.filter((e) => /settings_schema\.json is not valid JSON/.test(e))).toEqual([]);
  });
});

/* ─── T046 cli/validator-sections-dir-non-empty ────────────────────────────── */

describe("cli/validator-sections-dir-non-empty", () => {
  it("negative: empty src/sections/ → 'must have at least one section' error", async () => {
    const themeDir = await freshThemeDir();
    // Remove the only section (Hero.tsx) AND its schema (otherwise the
    // schema-without-component rule fires first and we want this rule).
    await fs.rm(path.join(themeDir, "src", "sections", "Hero.tsx"));
    await fs.rm(path.join(themeDir, "schemas", "sections", "hero.json"));
    const result = validateTheme(themeDir);
    const matched = result.errors.filter((e) => /must have at least one section/.test(e));
    expect(matched).toFailContractClause(CLI_VALIDATOR_SECTIONS_DIR_NON_EMPTY.id, {
      observed: "src/sections/ is empty",
      expected: "src/sections/ contains at least one file",
    });
  });

  it("positive: src/sections/ with one entry → no error", async () => {
    const themeDir = await freshThemeDir();
    const result = validateTheme(themeDir);
    expect(result.errors.filter((e) => /must have at least one section/.test(e))).toEqual([]);
  });
});

/* ─── T047 cli/validator-section-registry-sync (both directions) ───────────── */

describe("cli/validator-section-registry-schema-without-component", () => {
  it("negative: schema with no component → ERROR", async () => {
    const themeDir = await freshThemeDir();
    await fs.writeFile(
      path.join(themeDir, "schemas", "sections", "promo.json"),
      JSON.stringify({ type: "promo", name: "Promo", settings: [] }),
      "utf-8",
    );
    const result = validateTheme(themeDir);
    const matched = result.errors.filter((e) => /promo\.json has no matching component/.test(e));
    expect(matched).toFailContractClause(CLI_VALIDATOR_SECTION_REGISTRY_SCHEMA_WITHOUT_COMPONENT.id, {
      observed: "schemas/sections/promo.json with no src/sections/promo.tsx",
      expected: "every schema has a matching component (hard error)",
    });
  });

  it("positive: every schema has a matching component → no orphan-schema error", async () => {
    const themeDir = await freshThemeDir();
    const result = validateTheme(themeDir);
    expect(
      result.errors.filter((e) => /\.json has no matching component/.test(e)),
    ).toEqual([]);
  });
});

describe("cli/validator-section-registry-component-without-schema", () => {
  it("negative: component with no schema → WARNING (not error)", async () => {
    const themeDir = await freshThemeDir();
    await fs.writeFile(
      path.join(themeDir, "src", "sections", "Orphan.tsx"),
      `export function Orphan() { return null; }\n`,
      "utf-8",
    );
    const result = validateTheme(themeDir);
    const inWarnings = result.warnings.filter((w) => /Section "orphan" has no schema/.test(w));
    const inErrors = result.errors.filter((e) => /Section "orphan" has no schema/.test(e));
    expect(inWarnings).toFailContractClause(
      CLI_VALIDATOR_SECTION_REGISTRY_COMPONENT_WITHOUT_SCHEMA.id,
      {
        observed: `errors=${inErrors.length}, warnings=${inWarnings.length}`,
        expected: "orphan component appears in warnings (not errors)",
      },
    );
    expect(inErrors).toEqual([]);
  });

  it("positive: no orphan components → no warning", async () => {
    const themeDir = await freshThemeDir();
    const result = validateTheme(themeDir);
    expect(
      result.warnings.filter((w) => /has no schema at schemas\/sections\//.test(w)),
    ).toEqual([]);
  });
});

/* ─── T048 cli/validator-sdk-in-deps (WARNING, not error — §6e) ────────────── */

describe("cli/validator-sdk-in-deps", () => {
  it("negative: missing @numueg/theme-sdk in package.json deps → WARNING (NOT error per source)", async () => {
    const themeDir = await freshThemeDir();
    // Remove the sdk dep from the scaffolded package.json
    const pkgPath = path.join(themeDir, "package.json");
    const pkg = JSON.parse(await fs.readFile(pkgPath, "utf-8"));
    delete pkg.dependencies;
    delete pkg.peerDependencies;
    await fs.writeFile(pkgPath, JSON.stringify(pkg, null, 2), "utf-8");
    const result = validateTheme(themeDir);
    const inWarnings = result.warnings.filter((w) => /@numueg\/theme-sdk not found in dependencies/.test(w));
    const inErrors = result.errors.filter((e) => /@numueg\/theme-sdk not found in dependencies/.test(e));
    expect(inWarnings).toFailContractClause(CLI_VALIDATOR_SDK_IN_DEPS.id, {
      observed: `errors=${inErrors.length}, warnings=${inWarnings.length}`,
      expected: "missing SDK appears in warnings (not errors). Spec said 'error' but code says 'warning'.",
    });
    expect(inErrors).toEqual([]);
  });

  it("positive: package.json includes @numueg/theme-sdk → no warning", async () => {
    const themeDir = await freshThemeDir();
    const result = validateTheme(themeDir);
    expect(result.warnings.filter((w) => /@numueg\/theme-sdk not found/.test(w))).toEqual([]);
  });
});

/* ─── T049 cli/validator-no-env-files ──────────────────────────────────────── */

describe("cli/validator-no-env-files", () => {
  it.each([".env", ".env.local", ".env.production"])(
    "negative: %s at theme root → ERROR",
    async (envFile) => {
      const themeDir = await freshThemeDir();
      await fs.writeFile(path.join(themeDir, envFile), "SECRET=xyz\n", "utf-8");
      const result = validateTheme(themeDir);
      const matched = result.errors.filter((e) => new RegExp(`^${envFile} found`).test(e));
      expect(matched).toFailContractClause(CLI_VALIDATOR_NO_ENV_FILES.id, {
        observed: `${envFile} present at theme root`,
        expected: `no .env files at theme root`,
      });
    },
  );

  it("positive: no .env files → no env-leak error", async () => {
    const themeDir = await freshThemeDir();
    const result = validateTheme(themeDir);
    expect(result.errors.filter((e) => /found — secrets must not be included/.test(e))).toEqual([]);
  });
});

/* ─── T050 cli/validator-presets-warning ───────────────────────────────────── */

describe("cli/validator-presets-warning", () => {
  it("negative: theme.json without presets → WARNING (not error)", async () => {
    const themeDir = await freshThemeDir();
    await patchThemeJson(themeDir, (o) => delete o.presets);
    const result = validateTheme(themeDir);
    const inWarnings = result.warnings.filter((w) => /no presets/.test(w));
    const inErrors = result.errors.filter((e) => /no presets/.test(e));
    expect(inWarnings).toFailContractClause(CLI_VALIDATOR_PRESETS_WARNING.id, {
      observed: `errors=${inErrors.length}, warnings=${inWarnings.length}`,
      expected: "missing presets appears in warnings (not errors)",
    });
    expect(inErrors).toEqual([]);
  });

  it("positive: theme.json with at least one preset → no presets warning", async () => {
    const themeDir = await freshThemeDir();
    const result = validateTheme(themeDir);
    expect(result.warnings.filter((w) => /no presets/.test(w))).toEqual([]);
  });
});

/* ─── Sanity: a fully scaffolded theme should be valid ─────────────────────── */

describe("validator clean baseline", () => {
  it("a freshly-scaffolded theme has zero errors (the WARN about missing author is expected without it set)", async () => {
    const themeDir = await freshThemeDir();
    // scaffoldValidTheme doesn't set theme.json.author by default — set
    // it here so the baseline is clean for this assertion.
    await patchThemeJson(themeDir, (o) => {
      o.author = "Test Author <test@example.test>";
    });
    const result = validateTheme(themeDir);
    expect(result.errors).toEqual([]);
    // Warnings allowed — but none of the "fatal" ones should appear.
    const fatalSounding = result.warnings.filter((w) =>
      /no presets|@numueg\/theme-sdk not found|Missing settings_schema/.test(w),
    );
    expect(fatalSounding).toEqual([]);
  });
});
