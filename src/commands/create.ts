import { Command } from "commander";
import { loadConfig } from "../utils/config";
import { apiRequest } from "../utils/api";

interface Listing {
  id: string;
  slug: string;
  status: string;
}

/**
 * Create a marketplace theme listing and print its id.
 *
 * `numu-theme submit --theme-id` needs a listing, and until this command
 * nothing in the CLI created one: developers were told to use a dashboard
 * page that does not exist.
 */
export const createCommand = new Command("create")
  .description("Create a marketplace theme listing (prints the --theme-id for submit)")
  .requiredOption("-n, --name <name>", "Listing name")
  .requiredOption("-s, --slug <slug>", "Listing slug (3-64 chars)")
  .option("--description <text>", "Short description")
  .action(async (opts: { name: string; slug: string; description?: string }) => {
    if (!loadConfig().token) {
      console.error("Not logged in. Run: numu-theme login");
      process.exit(1);
    }
    const res = await apiRequest<Listing>("POST", "/marketplace/developer/themes", {
      name: opts.name,
      slug: opts.slug,
      short_description: opts.description,
    });
    if (res.status === 404) {
      console.error("✗ Only approved NUMU partners can list themes. Apply at /partners in the dashboard.");
      process.exit(1);
    }
    if (res.status < 200 || res.status >= 300) {
      console.error(`✗ Creating the listing failed (HTTP ${res.status}):`);
      console.error(JSON.stringify(res.raw, null, 2));
      process.exit(1);
    }
    console.log(`✓ Listing ${res.data.slug} created (${res.data.status})`);
    console.log(`  theme id: ${res.data.id}`);
    console.log(`  Next: numu-theme submit --theme-id ${res.data.id}`);
  });
