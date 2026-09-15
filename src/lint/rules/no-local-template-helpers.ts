/**
 * Rule: no-local-template-helpers
 *
 * `resolveSections` and `selectTemplateSections` decide which sections render
 * (host customisation, else the bundled preset). That is engine policy, and
 * getting it wrong blanks a store. The SDK has exported both since 0.12.0, yet
 * copies kept being vendored into themes after the hoist (theme-section-base
 * PHASE-6 § 6.2). Matches DEFINITIONS, exported or not, because the old
 * scaffold defined them without exporting. A local wrapper that calls the SDK
 * (e.g. to normalise blocks) is fine.
 */

import type { LintContext, LintIssue, LintRule } from "../runner";

const HELPERS = ["resolveSections", "selectTemplateSections"];
const DEFINITION = new RegExp(
  `(?:function\\s+(${HELPERS.join("|")})\\s*[<(]|(?:const|let|var)\\s+(${HELPERS.join("|")})\\s*[:=])`,
);

const rule: LintRule = {
  id: "no-local-template-helpers",
  description:
    "Import resolveSections / selectTemplateSections from @numueg/theme-sdk instead of defining them",
  check(ctx: LintContext): LintIssue[] {
    const issues: LintIssue[] = [];
    for (const [file, source] of Object.entries(ctx.sources)) {
      const lines = source.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const match = DEFINITION.exec(lines[i]);
        if (!match || /^\s*(\/\/|\*)/.test(lines[i])) continue;
        const name = match[1] ?? match[2];
        issues.push({
          rule: rule.id,
          severity: "error",
          file,
          line: i + 1,
          message: `Local definition of \`${name}\` — the SDK owns template selection.`,
          suggestion: `import { ${name} } from "@numueg/theme-sdk" and delete the local copy.`,
        });
      }
    }
    return issues;
  },
};

export default rule;
