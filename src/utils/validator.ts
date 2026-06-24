import * as fs from "fs";
import * as path from "path";
import * as semver from "semver";

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateTheme(themeDir: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Rule 1: theme.json exists
  const themeJsonPath = path.join(themeDir, "theme.json");
  if (!fs.existsSync(themeJsonPath)) {
    errors.push("Missing theme.json in project root");
    return { valid: false, errors, warnings };
  }

  let themeJson: any;
  try {
    themeJson = JSON.parse(fs.readFileSync(themeJsonPath, "utf-8"));
  } catch {
    errors.push("theme.json is not valid JSON");
    return { valid: false, errors, warnings };
  }

  // Rule 2: Required fields
  for (const field of ["name", "version", "author"]) {
    if (!themeJson[field]) errors.push(`theme.json missing required field: ${field}`);
  }

  // Rule 3: Valid semver
  if (themeJson.version && !semver.valid(themeJson.version)) {
    errors.push(`theme.json version "${themeJson.version}" is not valid semver`);
  }

  // Rule 4: settings_schema.json exists
  const settingsPath = path.join(themeDir, "settings_schema.json");
  if (!fs.existsSync(settingsPath)) {
    warnings.push("Missing settings_schema.json — theme will have no global settings");
  } else {
    try { JSON.parse(fs.readFileSync(settingsPath, "utf-8")); }
    catch { errors.push("settings_schema.json is not valid JSON"); }
  }

  // Rule 5: At least one section
  const sectionsDir = path.join(themeDir, "src", "sections");
  if (!fs.existsSync(sectionsDir) || fs.readdirSync(sectionsDir).length === 0) {
    errors.push("Theme must have at least one section in src/sections/");
  }

  // Rule 6: Section registry ↔ schema sync (Phase 2.6)
  //
  // Drift between `src/sections/<Type>.tsx` and `schemas/sections/<type>.json`
  // is a known footgun: the customizer reads the JSON, the storefront reads
  // the component, and a missing pair crashes at customizer runtime ("section
  // type X not found in registry") OR at storefront mount ("no schema for
  // type X"). We catch both directions at validate time so theme devs see
  // the failure before publishing.
  //
  // Direction 1 (component without schema): warning. The plugin's codegen
  // will skip it but the merchant won't be able to add it via the customizer.
  // Direction 2 (schema without component): ERROR. Adding the schema's
  // section in the customizer will throw at the storefront on the next render.
  const schemaDir = path.join(themeDir, "schemas", "sections");
  const componentNames = new Set<string>();
  const schemaNames = new Set<string>();
  if (fs.existsSync(sectionsDir)) {
    for (const file of fs.readdirSync(sectionsDir)) {
      if (!/\.(tsx|ts|jsx|js)$/.test(file)) continue;
      componentNames.add(path.basename(file, path.extname(file)).toLowerCase());
    }
  }
  if (fs.existsSync(schemaDir)) {
    for (const file of fs.readdirSync(schemaDir)) {
      if (!file.endsWith(".json")) continue;
      schemaNames.add(path.basename(file, ".json").toLowerCase());
    }
  }
  for (const name of componentNames) {
    if (!schemaNames.has(name)) {
      warnings.push(
        `Section "${name}" has no schema at schemas/sections/${name}.json — ` +
          "merchants won't be able to add this section via the customizer.",
      );
    }
  }
  for (const name of schemaNames) {
    if (!componentNames.has(name)) {
      errors.push(
        `schemas/sections/${name}.json has no matching component at src/sections/<${name}>.tsx — ` +
          "the storefront will throw 'unknown section type' the moment a merchant adds it.",
      );
    }
  }

  // Rule 7: package.json has @numueg/theme-sdk
  const pkgPath = path.join(themeDir, "package.json");
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
      const deps = { ...pkg.dependencies, ...pkg.peerDependencies };
      if (!deps["@numueg/theme-sdk"]) {
        warnings.push("@numueg/theme-sdk not found in dependencies — hooks will not be available");
      }
    } catch {}
  }

  // Rule 8: No .env files in theme
  for (const envFile of [".env", ".env.local", ".env.production"]) {
    if (fs.existsSync(path.join(themeDir, envFile))) {
      errors.push(`${envFile} found — secrets must not be included in themes`);
    }
  }

  // Rule 9: presets in theme.json
  if (!themeJson.presets || Object.keys(themeJson.presets).length === 0) {
    warnings.push("theme.json has no presets — merchants will start with an empty page");
  }

  // Rule 10: preset → section-type coverage + required-template coverage.
  //
  // Mirrors the platform gate (@numueg/theme-sdk validateManifest + the
  // backend theme-contract check): every section type a preset references must
  // ship a schema (else the storefront drops it at render), and the canonical
  // page templates should have presets (else the storefront falls back to a
  // built-in — a warning, not an error).
  const REQUIRED_TEMPLATES = [
    "home",
    "product",
    "collection",
    "cart",
    "page",
    "search",
    "404",
  ];
  if (themeJson.presets && typeof themeJson.presets === "object") {
    const referenced = new Set<string>();
    for (const bucket of [
      themeJson.presets.templates,
      themeJson.presets.section_groups,
    ]) {
      if (!bucket || typeof bucket !== "object") continue;
      for (const entry of Object.values(bucket as Record<string, any>)) {
        const sections = (entry as any)?.sections;
        const instances = Array.isArray(sections)
          ? sections
          : sections && typeof sections === "object"
            ? Object.values(sections)
            : [];
        for (const inst of instances as any[]) {
          if (inst && typeof inst.type === "string") {
            referenced.add(inst.type.toLowerCase());
          }
        }
      }
    }
    for (const type of referenced) {
      if (!schemaNames.has(type)) {
        errors.push(
          `theme.json preset references section type "${type}" but there is no ` +
            `schemas/sections/${type}.json — the storefront drops unknown sections at render.`,
        );
      }
    }
    const templates =
      themeJson.presets.templates &&
      typeof themeJson.presets.templates === "object"
        ? themeJson.presets.templates
        : {};
    for (const tpl of REQUIRED_TEMPLATES) {
      if (!(tpl in templates)) {
        warnings.push(
          `theme.json has no preset for the "${tpl}" template — the storefront ` +
            "will use its built-in fallback.",
        );
      }
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}
