import { Command } from "commander";
import * as readline from "readline";
import { apiRequest } from "../utils/api";

/**
 * Delete a theme (or a single version) from the marketplace —
 * Phase 7.7.
 *
 * Two modes:
 *   numu-theme delete <theme-id>               → soft-delete the whole
 *                                                theme. Existing
 *                                                installations keep
 *                                                running; the listing
 *                                                is hidden from the
 *                                                catalog.
 *   numu-theme delete <theme-id> --version v   → delete one version
 *                                                only. Useful for
 *                                                pulling a broken
 *                                                release without
 *                                                taking the whole
 *                                                theme offline.
 *
 * Always prompts unless --yes is passed. We default-prompt because
 * deleting a theme is rarely what a dev meant to do at 3am — and the
 * marketplace install endpoint is keyed on theme_id, so a delete
 * breaks merchants who try to (re-)install.
 */

async function confirm(prompt: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(`${prompt} [y/N] `, (answer) => {
      rl.close();
      resolve(/^y(es)?$/i.test(answer.trim()));
    });
  });
}

export const deleteCommand = new Command("delete")
  .description("Delete a theme or a specific version from the marketplace")
  .argument("<theme-id>", "Theme slug or UUID")
  .option("-v, --version <version>", "Delete this version only (default: whole theme)")
  .option("-y, --yes", "Skip the confirmation prompt")
  .action(
    async (
      themeId: string,
      options: { version?: string; yes?: boolean },
    ) => {
      const isVersion = Boolean(options.version);
      const scope = isVersion
        ? `version ${options.version} of ${themeId}`
        : `the entire theme ${themeId}`;

      if (!options.yes) {
        const ok = await confirm(
          `This will permanently delete ${scope}. Existing installations may break. Continue?`,
        );
        if (!ok) {
          console.log("Cancelled.");
          return;
        }
      }

      const path = isVersion
        ? `/api/v1/marketplace/themes/${encodeURIComponent(themeId)}/versions/${encodeURIComponent(options.version!)}`
        : `/api/v1/marketplace/themes/${encodeURIComponent(themeId)}`;

      const res = await apiRequest<{ id?: string }>("DELETE", path);

      if (res.status === 200 || res.status === 204) {
        console.log(`✔ Deleted ${scope}.`);
        return;
      }
      if (res.status === 404) {
        console.error("Not found. Already deleted, or you don't have access.");
        process.exit(1);
      }
      if (res.status === 403) {
        console.error("Forbidden. You can only delete themes you own.");
        process.exit(1);
      }
      console.error(`Delete failed (HTTP ${res.status}).`);
      process.exit(1);
    },
  );
