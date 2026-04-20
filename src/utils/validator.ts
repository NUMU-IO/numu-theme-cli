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

  // Rule 6: Section schemas
  if (fs.existsSync(sectionsDir)) {
    const sectionFiles = fs.readdirSync(sectionsDir).filter(f => f.endsWith(".tsx") || f.endsWith(".jsx"));
    const schemaDir = path.join(themeDir, "schemas", "sections");
    for (const file of sectionFiles) {
      const name = path.basename(file, path.extname(file)).toLowerCase();
      const schemaPath = path.join(schemaDir, `${name}.json`);
      if (!fs.existsSync(schemaPath)) {
        warnings.push(`Section "${name}" has no schema file at schemas/sections/${name}.json`);
      }
    }
  }

  // Rule 7: package.json has @numu/theme-sdk
  const pkgPath = path.join(themeDir, "package.json");
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
      const deps = { ...pkg.dependencies, ...pkg.peerDependencies };
      if (!deps["@numu/theme-sdk"]) {
        warnings.push("@numu/theme-sdk not found in dependencies — hooks will not be available");
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

  return { valid: errors.length === 0, errors, warnings };
}
