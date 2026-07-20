/**
 * Rule: no-kit-image-transform
 *
 * `@numueg/theme-kit` and `@numueg/theme-sdk` BOTH export
 * `applyImageTransform` / `asImageTransform` / `ImageTransform`, and they
 * disagree on the one case that matters most:
 *
 *   theme-sdk:  if (!transform) return {}                    <- the fleet's behaviour
 *   theme-kit:  if (!transform) return { objectFit: fit }    <- stale
 *
 * An inline style beats a className, so the kit's version silently overrides a
 * placement's own `object-contain` / `object-none` class on every image that
 * has NO transform — which is most merchant images. A header logo that should
 * fit inside its box starts cropping, and nothing errors.
 *
 * The whole fleet was migrated onto the SDK's version. Nothing imports the
 * kit's today, which makes this a trap rather than a bug: the two packages sit
 * side by side in every theme's node_modules, and one "tidy up the imports"
 * change reintroduces the regression across a live storefront.
 *
 * Image transforms come from @numueg/theme-sdk. Always.
 */

import type { LintContext, LintIssue, LintRule } from "../runner";

/** The image-transform symbols theme-kit also exports. */
const KIT_IMAGE_EXPORTS = [
  "applyImageTransform",
  "asImageTransform",
  "ImageTransform",
];

const KIT_IMPORT = /import\s+(?:type\s+)?\{([^}]*)\}\s*from\s*["']@numueg\/theme-kit["']/g;

const rule: LintRule = {
  id: "no-kit-image-transform",
  description:
    "Image transforms must come from @numueg/theme-sdk, never @numueg/theme-kit " +
    "(the kit's copy forces object-fit on untransformed images)",
  check(ctx: LintContext): LintIssue[] {
    const issues: LintIssue[] = [];

    for (const [file, source] of Object.entries(ctx.sources)) {
      // Walk every theme-kit import and look at what it pulls in. Matching on
      // the import statement rather than bare identifiers avoids flagging the
      // (correct) SDK usage that appears in the same files.
      for (const match of source.matchAll(KIT_IMPORT)) {
        const named = match[1]
          .split(",")
          .map((n) => n.trim().replace(/^type\s+/, "").split(/\s+as\s+/)[0].trim())
          .filter(Boolean);

        const offenders = named.filter((n) => KIT_IMAGE_EXPORTS.includes(n));
        if (offenders.length === 0) continue;

        const line = source.slice(0, match.index ?? 0).split("\n").length;
        issues.push({
          rule: rule.id,
          severity: "error",
          file,
          line,
          message:
            `${offenders.join(", ")} imported from @numueg/theme-kit. The kit's ` +
            `applyImageTransform returns { objectFit } for an untransformed ` +
            `image, which overrides the element's own object-fit class and ` +
            `silently re-crops most merchant images.`,
          suggestion: `Import ${offenders.join(", ")} from "@numueg/theme-sdk" instead.`,
        });
      }
    }

    return issues;
  },
};

export default rule;
