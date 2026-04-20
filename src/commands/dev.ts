import { Command } from "commander";
import { execSync } from "child_process";
import { loadConfig } from "../utils/config";
import { apiRequest } from "../utils/api";

export const devCommand = new Command("dev")
  .description("Start local development server with HMR")
  .option("-p, --port <port>", "Dev server port", "5173")
  .option("-s, --store <store_id>", "Store ID to connect to")
  .action(async (options: { port: string; store?: string }) => {
    const config = loadConfig();
    const storeId = options.store || config.store_id;

    if (storeId && config.token) {
      console.log(`Registering dev server with store ${storeId}...`);
      try {
        await apiRequest("POST", `/stores/${storeId}/themes/connect-dev`, {
          dev_url: `http://localhost:${options.port}`,
          mode: "development",
        });
        console.log("Dev server registered. Changes will appear in your storefront.");
      } catch (err) {
        console.warn("Could not register dev server (store may not be accessible)");
      }
    }

    console.log(`Starting dev server on port ${options.port}...`);
    try {
      execSync(`npx vite --port ${options.port} --host`, { stdio: "inherit" });
    } catch {}
  });
