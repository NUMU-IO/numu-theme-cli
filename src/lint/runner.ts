/**
 * Lint runner — Phase 9 polish.
 *
 * Each rule is a self-contained module exporting `id`, `description`,
 * and `check(ctx)`. The runner loads them, builds a shared context
 * (parsed theme.json, schemas, locales, source files), and executes
 * each rule in turn. Rules don't share mutable state — context is
 * read-only.
 */

import * as fs from "fs";
import * as path from "path";

export type Severity = "error" | "warning" | "info";

export interface LintIssue {
  rule: string;
  severity: Severity;
  /** Theme-relative path. Undefined for theme-wide issues. */
  file?: string;
  line?: number;
  message: string;
  /** Optional fix suggestion shown after the message. */
  suggestion?: string;
}

export interface LintContext {
  themeDir: string;
  manifest: Record<string, unknown>;
  /** Parsed contents of settings_schema.json (or [] when missing). */
  settingsSchema: unknown[];
  /** Map from section type → parsed section schema. */
  sectionSchemas: Record<string, Record<string, unknown>>;
  /** Map from block type → parsed block schema. */
  blockSchemas: Record<string, Record<string, unknown>>;
  /** Map from locale code ("en", "ar", ...) → parsed locale file dict. */
  locales: Record<string, Record<string, unknown>>;
  /** Map from theme-relative source path → file contents. */
  sources: Record<string, string>;
}

export interface LintRule {
  id: string;
  description: string;
  check(ctx: LintContext): LintIssue[] | Promise<LintIssue[]>;
}

interface RunOptions {
  enabledRules: Set<string> | null;
}

export async function runAllRules(
  themeDir: string,
  options: RunOptions,
): Promise<LintIssue[]> {
  const ctx = buildContext(themeDir);

  // Lazy-imports so a rule module crashing doesn't take out the whole
  // command — we want partial results even when one rule breaks.
  const ruleLoaders = [
    () => import("./rules/schema-registry-sync"),
    () => import("./rules/locale-parity"),
    () => import("./rules/preset-schema-conformance"),
    () => import("./rules/unused-settings"),
    () => import("./rules/img-missing-alt"),
    () => import("./rules/hardcoded-text"),
    () => import("./rules/inline-color-literal"),
    () => import("./rules/forbidden-script-tag"),
    () => import("./rules/use-app-no-availability-check"),
    () => import("./rules/manifest-required-fields"),
  ];

  const issues: LintIssue[] = [];
  for (const load of ruleLoaders) {
    let mod;
    try {
      mod = await load();
    } catch (e) {
      issues.push({
        rule: "internal",
        severity: "warning",
        message: `Failed to load rule module: ${(e as Error).message}`,
      });
      continue;
    }
    const rule = mod.default as LintRule;
    if (options.enabledRules && !options.enabledRules.has(rule.id)) continue;
    try {
      const ruleIssues = await rule.check(ctx);
      for (const issue of ruleIssues) issues.push(issue);
    } catch (e) {
      issues.push({
        rule: rule.id,
        severity: "warning",
        message: `Rule crashed: ${(e as Error).message}`,
      });
    }
  }
  return issues;
}

function buildContext(themeDir: string): LintContext {
  const manifest = readJson(path.join(themeDir, "theme.json"), {}) as Record<
    string,
    unknown
  >;
  const settingsSchema = readJson(
    path.join(themeDir, "settings_schema.json"),
    [],
  ) as unknown[];
  const sectionSchemas = readSchemaDir(
    path.join(themeDir, "schemas", "sections"),
  );
  const blockSchemas = readSchemaDir(path.join(themeDir, "schemas", "blocks"));
  const locales = readLocales(path.join(themeDir, "locales"));
  const sources = readSources(themeDir);
  return {
    themeDir,
    manifest,
    settingsSchema,
    sectionSchemas,
    blockSchemas,
    locales,
    sources,
  };
}

function readJson<T>(filePath: string, fallback: T): T {
  if (!fs.existsSync(filePath)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8")) as T;
  } catch {
    return fallback;
  }
}

function readSchemaDir(dir: string): Record<string, Record<string, unknown>> {
  const out: Record<string, Record<string, unknown>> = {};
  if (!fs.existsSync(dir)) return out;
  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith(".json")) continue;
    const parsed = readJson(path.join(dir, file), null);
    if (parsed && typeof parsed === "object") {
      const type =
        (parsed as Record<string, unknown>).type ||
        file.replace(/\.json$/, "");
      out[type as string] = parsed as Record<string, unknown>;
    }
  }
  return out;
}

function readLocales(dir: string): Record<string, Record<string, unknown>> {
  const out: Record<string, Record<string, unknown>> = {};
  if (!fs.existsSync(dir)) return out;
  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith(".json")) continue;
    // Names like `en.default.json` → locale = "en"; `ar.json` → "ar".
    const locale = file.replace(/\.(default\.)?json$/, "");
    const parsed = readJson(path.join(dir, file), {});
    out[locale] = parsed as Record<string, unknown>;
  }
  return out;
}

function readSources(themeDir: string): Record<string, string> {
  const out: Record<string, string> = {};
  const srcDir = path.join(themeDir, "src");
  if (!fs.existsSync(srcDir)) return out;
  walk(srcDir, (file) => {
    if (!/\.(tsx?|jsx?)$/.test(file)) return;
    const rel = path.relative(themeDir, file).replace(/\\/g, "/");
    out[rel] = fs.readFileSync(file, "utf-8");
  });
  return out;
}

function walk(dir: string, visit: (file: string) => void) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, visit);
    else visit(full);
  }
}
