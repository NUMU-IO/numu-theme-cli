import * as fs from "fs";
import * as path from "path";
import { validateManifest } from "@numueg/theme-sdk/validation";

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

  // (Rules 2/3/9/10 — the theme.json manifest contract — are delegated to the
  // SDK validator near the end of this function; see the note there.)

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

  // Rules 2/3/9/10 — manifest contract — delegated to the SDK's single source
  // of truth (`@numueg/theme-sdk/validation`). This covers: required fields
  // (`id`, `name`, `version`, `author`), lowercase `id` format, strict semver,
  // the empty-presets warning, preset→section-type coverage, and required-
  // template coverage. Passing `sectionTypes` (the shipped schema basenames)
  // lets the SDK flag presets that reference a section with no schema — the
  // same error the storefront would hit at render. Keeping this here (instead
  // of re-deriving the rules) is what guarantees `check` and `build` agree.
  const manifestResult = validateManifest(themeJson, {
    sectionTypes: schemaNames,
  });
  for (const issue of manifestResult.issues) {
    const message = issue.path
      ? `${issue.message} (${issue.path})`
      : issue.message;
    if (issue.level === "error") errors.push(message);
    else warnings.push(message);
  }

  return { valid: errors.length === 0, errors, warnings };
}
