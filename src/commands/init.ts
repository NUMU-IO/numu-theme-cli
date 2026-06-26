import { Command } from "commander";
import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

/**
 * Best-effort author string for the scaffolded theme.json. `author` is a
 * required, non-empty field (the marketplace build re-validates it), so an
 * empty default makes a freshly-scaffolded theme fail `numu-theme check`.
 * Derive it from the local git identity when available; otherwise fall back
 * to a non-empty placeholder the dev can edit later.
 */
function detectAuthor(): string {
  const git = (args: string): string => {
    try {
      return execSync(`git config ${args}`, {
        stdio: ["ignore", "pipe", "ignore"],
      })
        .toString()
        .trim();
    } catch {
      return "";
    }
  };
  const name = git("user.name");
  const email = git("user.email");
  if (name && email) return `${name} <${email}>`;
  if (name) return name;
  return "Theme Author";
}

/**
 * Locate the bundled scaffold template tree. Ships in the npm package next to
 * `dist/` (see package.json "files"); `__dirname` is the dist folder at
 * runtime, so the templates live one level up.
 */
function scaffoldRoot(): string {
  const candidates = [
    path.join(__dirname, "..", "templates", "scaffold"),
    path.join(__dirname, "..", "..", "templates", "scaffold"),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  throw new Error(
    "Could not locate the scaffold templates. Reinstall @numueg/theme-cli.",
  );
}

/** Files whose contents carry `__TOKEN__` placeholders to substitute. */
const SUBSTITUTED = new Set([
  "theme.json",
  "package.json",
  "index.html",
  path.join("src", "dev-entry.tsx"),
]);

function applyTokens(content: string, tokens: Record<string, string>): string {
  return content.replace(/__([A-Z_]+)__/g, (whole, key: string) =>
    key in tokens ? tokens[key] : whole,
  );
}

/** Recursively copy `from` → `to`, substituting tokens in known text files. */
function copyTree(
  from: string,
  to: string,
  rel: string,
  tokens: Record<string, string>,
): void {
  const entries = fs.readdirSync(from, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(from, entry.name);
    const dstPath = path.join(to, entry.name);
    const relPath = rel ? path.join(rel, entry.name) : entry.name;
    if (entry.isDirectory()) {
      fs.mkdirSync(dstPath, { recursive: true });
      copyTree(srcPath, dstPath, relPath, tokens);
    } else {
      let content = fs.readFileSync(srcPath, "utf-8");
      if (SUBSTITUTED.has(relPath)) content = applyTokens(content, tokens);
      fs.writeFileSync(dstPath, content);
    }
  }
}

/**
 * Scaffold a new NUMU theme project from the bundled "NUMU Starter" template.
 *
 * The starter is a complete, premium, production-shaped theme — not a stub —
 * so every new theme inherits the platform standards by default:
 *
 *   - Bilingual (AR/EN) section copy via the `useT()` helper (src/lib/i18n).
 *   - Money is always coerced with `Number()` and images resolved defensively
 *     (src/lib/format) so string-priced API rows never concatenate.
 *   - Inline field editing through the SDK-compatible `<EditableText>`; the
 *     entry forwards each section's id so the customizer can wire edits.
 *   - The brand resolves to the live store name (the header/footer placeholder
 *     is treated as unset), multi-currency + a language switcher in the header,
 *     and an always-on footer ticker.
 *   - A size-aware product page: sizes from the product's size chart render as
 *     required pickers that gate add-to-cart, plus an embedded
 *     "frequently bought together" bundle.
 *
 * Output is runnable end-to-end:
 *
 *   cd <name>
 *   npm install
 *   npx numu-theme dev      # Vite preview
 *   npx numu-theme check    # validate
 *   npx numu-theme build    # marketplace build
 *
 * Trim what you don't need — delete a section file, drop it from the
 * registry in src/main.tsx and from theme.json's presets.
 */
export const initCommand = new Command("init")
  .description("Scaffold a new NUMU theme project from the standard starter")
  .argument("<name>", "Theme name")
  .option("--template <template>", "Starter template", "basic")
  .action(async (name: string, _options: { template: string }) => {
    const dir = path.resolve(process.cwd(), name);
    if (fs.existsSync(dir)) {
      console.error(`Directory "${name}" already exists`);
      process.exit(1);
    }

    const themeId = name.toLowerCase().replace(/[^a-z0-9-]/g, "-");
    const tokens: Record<string, string> = {
      THEME_NAME: name,
      THEME_ID: themeId,
      PKG_NAME: themeId,
      AUTHOR: detectAuthor(),
      VERSION: "0.1.0",
    };

    console.log(`Creating NUMU theme: ${name}...`);

    let root: string;
    try {
      root = scaffoldRoot();
    } catch (err) {
      console.error((err as Error).message);
      process.exit(1);
    }

    fs.mkdirSync(dir, { recursive: true });
    copyTree(root, dir, "", tokens);

    console.log(
      `\nTheme "${name}" created from the NUMU Starter.\n\nNext steps:\n  cd ${name}\n  npm install\n  npx numu-theme dev     # local preview\n  npx numu-theme check   # validate\n  npx numu-theme build   # production build\n`,
    );
  });
