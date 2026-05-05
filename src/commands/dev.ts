import { Command } from "commander";
import { spawn } from "child_process";
import { loadConfig } from "../utils/config";
import { apiRequest } from "../utils/api";

/**
 * Start a local Vite dev server and (optionally) register it with a store.
 *
 * Registration uses the actual backend endpoint:
 *   POST /stores/{store_id}/themes/external/dev-mode
 *   Body: { dev_url: "http://localhost:5173" }
 *
 * By default the dev server binds to localhost only. Pass `--expose` to
 * bind to all interfaces (useful for testing on a phone over LAN).
 */
export const devCommand = new Command("dev")
  .description("Start local development server with HMR")
  .option("-p, --port <port>", "Dev server port", "5173")
  .option("-s, --store <store_id>", "Store ID to register dev URL with")
  .option(
    "--expose",
    "Bind to 0.0.0.0 instead of localhost (use only on trusted networks)",
    false,
  )
  .action(
    async (options: { port: string; store?: string; expose: boolean }) => {
      const config = loadConfig();
      const storeId = options.store || config.store_id;

      if (storeId && config.token) {
        console.log(`Registering dev server with store ${storeId}...`);
        try {
          const res = await apiRequest(
            "POST",
            `/stores/${encodeURIComponent(storeId)}/themes/external/dev-mode`,
            {
              dev_url: `http://localhost:${options.port}`,
              mode: "development",
            },
          );
          if (res.status >= 300) {
            console.warn(
              `  Registration returned ${res.status}: ${JSON.stringify(res.data)}`,
            );
          } else {
            console.log("  Registered. Edits will reflect in your storefront.");
          }
        } catch (err) {
          console.warn(
            `  Could not register dev server: ${(err as Error).message}`,
          );
        }
      }

      const args = ["vite", "--port", options.port];
      if (options.expose) args.push("--host");
      console.log(
        `Starting Vite on ${options.expose ? "0.0.0.0" : "localhost"}:${options.port}...`,
      );

      // spawn instead of execSync so Ctrl+C is forwarded properly and
      // the parent process can clean up if Vite crashes.
      const child = spawn("npx", args, { stdio: "inherit", shell: true });
      child.on("exit", (code) => process.exit(code ?? 0));
    },
  );
