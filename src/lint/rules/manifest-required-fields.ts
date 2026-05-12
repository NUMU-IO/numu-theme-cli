/**
 * Rule: manifest-required-fields
 *
 * theme.json must have:
 *   - id        (alphanumerics + dashes + underscores)
 *   - name      (non-empty)
 *   - version   (semver x.y.z)
 *   - author    (non-empty; required for marketplace submission)
 *
 * Marketplace upload re-validates these; this rule catches them on
 * `numu-theme lint` so devs don't get rejected at submission.
 */

import type { LintContext, LintIssue, LintRule } from "../runner";

const SEMVER = /^\d+\.\d+\.\d+(?:[-+][\w.]+)?$/;
const ID_RE = /^[a-z0-9](?:[a-z0-9_-]*[a-z0-9])?$/i;

const rule: LintRule = {
  id: "manifest-required-fields",
  description: "theme.json has id / name / version / author with valid shapes",
  check(ctx: LintContext): LintIssue[] {
    const issues: LintIssue[] = [];
    const m = ctx.manifest;

    if (!m.id || typeof m.id !== "string") {
      issues.push({
        rule: rule.id,
        severity: "error",
        file: "theme.json",
        message: "Missing required field 'id'.",
      });
    } else if (!ID_RE.test(m.id as string)) {
      issues.push({
        rule: rule.id,
        severity: "error",
        file: "theme.json",
        message: `Field 'id' = '${m.id}' must be alphanumerics, dashes, or underscores.`,
      });
    }

    if (!m.name || typeof m.name !== "string" || !(m.name as string).trim()) {
      issues.push({
        rule: rule.id,
        severity: "error",
        file: "theme.json",
        message: "Missing or empty 'name'.",
      });
    }

    if (!m.version || typeof m.version !== "string") {
      issues.push({
        rule: rule.id,
        severity: "error",
        file: "theme.json",
        message: "Missing required field 'version'.",
      });
    } else if (!SEMVER.test(m.version as string)) {
      issues.push({
        rule: rule.id,
        severity: "error",
        file: "theme.json",
        message: `Field 'version' = '${m.version}' is not valid semver (x.y.z).`,
      });
    }

    if (!m.author || typeof m.author !== "string" || !(m.author as string).trim()) {
      issues.push({
        rule: rule.id,
        severity: "warning",
        file: "theme.json",
        message:
          "Field 'author' is empty — marketplace submission requires a non-empty author.",
        suggestion: `Set "author": "Your Name" in theme.json.`,
      });
    }
    return issues;
  },
};

export default rule;
