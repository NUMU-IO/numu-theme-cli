import { Command } from "commander";
import * as fs from "fs";
import * as path from "path";
import { loadConfig } from "../utils/config";
import { apiRequest } from "../utils/api";

/**
 * `numu app …` — build a NUMU Partner App (apps plan, Phase 3).
 *
 * An app version is a `numu.app.json` manifest. The API owns the rules:
 * `validate` calls its dry-run endpoint, so the CLI can never drift from what
 * an upload accepts. Commands resolve the app by the `slug` in the manifest,
 * so nothing but the manifest lives in the project.
 *
 *   numu app init my-app        scaffold numu.app.json + the Claude skill
 *   numu app validate           the API's rules, nothing stored
 *   numu app create             register the slug; prints the client secret ONCE
 *   numu app version            upload numu.app.json as a draft version
 *   numu app submit             send the newest draft for NUMU review
 *   numu app status             versions, statuses and NUMU's notes
 *   numu app publish            make the approved version live
 *   numu app install --store    install on one of your development stores
 */

const MANIFEST = "numu.app.json";
const APPS = "/partners/me/apps";

interface Version {
  id: string;
  version: string;
  status: string;
  review_notes: { ar?: string; en?: string } | null;
}

interface App {
  id: string;
  slug: string;
  name: string;
  status: string;
  version: string;
  client_id: string | null;
  catalog_visible: boolean;
  versions?: Version[];
}

function fail(message: string): never {
  console.error(`✗ ${message}`);
  process.exit(1);
}

/** Print what the API said and exit, for any non-2xx response. */
function check(res: { status: number; raw: unknown }, what: string): void {
  if (res.status >= 200 && res.status < 300) return;
  if (res.status === 404) {
    fail(
      `${what}: not found. Are you an approved NUMU partner, and is the Partner program open?`,
    );
  }
  const message = (res.raw as { error?: { message?: string } } | null)?.error?.message;
  console.error(`✗ ${what} failed (HTTP ${res.status}):`);
  console.error(message ? message.replace(/^/gm, "  ") : JSON.stringify(res.raw, null, 2));
  process.exit(1);
}

function requireLogin(): void {
  if (!loadConfig().token) fail("Not logged in. Run: numu login");
}

function readManifest(dir: string): Record<string, unknown> {
  const file = path.resolve(dir, MANIFEST);
  if (!fs.existsSync(file)) fail(`No ${MANIFEST} in ${path.resolve(dir)}. Run: numu app init`);
  try {
    return JSON.parse(fs.readFileSync(file, "utf-8"));
  } catch (err) {
    fail(`${MANIFEST} is not valid JSON: ${(err as Error).message}`);
  }
}

async function findApp(slug: string, detail = true): Promise<App> {
  const res = await apiRequest<App[]>("GET", APPS);
  check(res, "Listing your apps");
  const app = res.data.find((a) => a.slug === slug);
  if (!app) fail(`No app "${slug}" in your partner account. Run: numu app create`);
  if (!detail) return app;
  const full = await apiRequest<App>("GET", `${APPS}/${app.id}`);
  check(full, "Reading the app");
  return full.data;
}

const dirOption = ["-d, --dir <directory>", "Project directory", "."] as const;

const init = new Command("init")
  .description("Scaffold a Partner App: numu.app.json and the numu-app-developer Claude skill")
  .argument("<slug>", "App slug: lowercase letters, numbers, dashes")
  .action((slug: string) => {
    if (!/^[a-z][a-z0-9-]{2,40}$/.test(slug)) fail("slug must match ^[a-z][a-z0-9-]{2,40}$");
    const target = path.resolve(slug);
    if (fs.existsSync(target)) fail(`${target} already exists`);
    const template = path.join(__dirname, "..", "templates", "app");
    fs.cpSync(template, target, { recursive: true });
    const file = path.join(target, MANIFEST);
    fs.writeFileSync(file, fs.readFileSync(file, "utf-8").replace(/__SLUG__/g, slug));
    console.log(`✓ Created ${target}`);
    console.log("  Next: edit numu.app.json (Arabic AND English copy), then");
    console.log("        numu app validate && numu app create && numu app version");
  });

const validate = new Command("validate")
  .description("Check numu.app.json against the API's rules (nothing is stored)")
  .option(...dirOption)
  .action(async (opts: { dir: string }) => {
    requireLogin();
    const res = await apiRequest("POST", `${APPS}/validate`, { manifest: readManifest(opts.dir) });
    check(res, "Validation");
    console.log(`✓ ${MANIFEST} is valid`);
  });

const create = new Command("create")
  .description("Register the app in your partner account (prints the client secret once)")
  .option(...dirOption)
  .action(async (opts: { dir: string }) => {
    requireLogin();
    const m = readManifest(opts.dir) as { slug?: string; name?: { ar?: string; en?: string } };
    const res = await apiRequest<App & { client_secret: string }>("POST", APPS, {
      slug: m.slug,
      name_ar: m.name?.ar,
      name_en: m.name?.en,
    });
    check(res, "Creating the app");
    console.log(`✓ Created ${res.data.slug}`);
    console.log(`  client_id:     ${res.data.client_id}`);
    console.log(`  client_secret: ${res.data.client_secret}`);
    console.log("  Save the secret now: NUMU never shows it again.");
  });

const version = new Command("version")
  .description("Upload numu.app.json as a new draft version")
  .option(...dirOption)
  .option("--notes-ar <text>", "Release notes in Arabic")
  .option("--notes-en <text>", "Release notes in English")
  .action(async (opts: { dir: string; notesAr?: string; notesEn?: string }) => {
    requireLogin();
    const manifest = readManifest(opts.dir) as { slug: string };
    const app = await findApp(manifest.slug, false);
    const res = await apiRequest<Version>("POST", `${APPS}/${app.id}/versions`, {
      manifest,
      release_notes_ar: opts.notesAr,
      release_notes_en: opts.notesEn,
    });
    check(res, "Uploading the version");
    console.log(`✓ v${res.data.version} uploaded (${res.data.status}). Next: numu app submit`);
  });

const submit = new Command("submit")
  .description("Send the newest draft (or changes-requested) version for NUMU review")
  .option(...dirOption)
  .action(async (opts: { dir: string }) => {
    requireLogin();
    const app = await findApp((readManifest(opts.dir) as { slug: string }).slug);
    const v = app.versions?.find((x) => x.status === "draft" || x.status === "changes_requested");
    if (!v) fail("No draft version to submit. Run: numu app version");
    const res = await apiRequest<Version>("POST", `${APPS}/${app.id}/versions/${v.id}/submit`);
    check(res, "Submitting");
    console.log(`✓ v${v.version} submitted for review`);
  });

const status = new Command("status")
  .description("Show the app's versions, their review status and NUMU's notes")
  .option(...dirOption)
  .action(async (opts: { dir: string }) => {
    requireLogin();
    const app = await findApp((readManifest(opts.dir) as { slug: string }).slug);
    console.log(`${app.name} (${app.slug}) — ${app.status}, live v${app.version}`);
    console.log(`  client_id: ${app.client_id}`);
    console.log(`  listed in the App Store: ${app.catalog_visible ? "yes" : "no"}`);
    for (const v of app.versions ?? []) {
      console.log(`  v${v.version}  ${v.status}`);
      if (v.review_notes?.en) console.log(`      NUMU: ${v.review_notes.en}`);
    }
  });

const publish = new Command("publish")
  .description("Publish the approved version (it becomes the live one)")
  .option(...dirOption)
  .action(async (opts: { dir: string }) => {
    requireLogin();
    const app = await findApp((readManifest(opts.dir) as { slug: string }).slug);
    const v = app.versions?.find((x) => x.status === "approved");
    if (!v) fail("No approved version. Check: numu app status");
    const res = await apiRequest("POST", `${APPS}/${app.id}/versions/${v.id}/publish`);
    check(res, "Publishing");
    console.log(`✓ v${v.version} is live`);
  });

const install = new Command("install")
  .description("Install the app on one of your development stores")
  .requiredOption("-s, --store <store_id>", "Development store id")
  .option(...dirOption)
  .action(async (opts: { dir: string; store: string }) => {
    requireLogin();
    const app = await findApp((readManifest(opts.dir) as { slug: string }).slug, false);
    const res = await apiRequest("POST", `${APPS}/${app.id}/dev-install`, { store_id: opts.store });
    check(res, "Installing");
    console.log(`✓ Installed ${app.slug} on development store ${opts.store}`);
  });

export const appCommand = new Command("app")
  .description("Build and publish a NUMU Partner App")
  .addCommand(init)
  .addCommand(validate)
  .addCommand(create)
  .addCommand(version)
  .addCommand(submit)
  .addCommand(status)
  .addCommand(publish)
  .addCommand(install);
