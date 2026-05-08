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
 *
 * --watch: also runs `vite build --watch` alongside the dev server, so
 * `dist/theme.js` is rebuilt on every save. The dev-mode connector
 * serves theme.js from `dist/` (via the plugin's configureServer
 * middleware), which means the storefront iframe always sees the
 * latest build without the developer manually re-running
 * `numu-theme build`. The PreviewBridge still drives in-iframe
 * settings updates separately.
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
  .option(
    "--watch",
    "Also run `vite build --watch` so dist/theme.js auto-rebuilds on save",
    false,
  )
  .action(
    async (options: {
      port: string;
      store?: string;
      expose: boolean;
      watch: boolean;
    }) => {
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

      // Watcher process: separate `vite build --watch` invocation that
      // rebuilds dist/theme.js on save. Vite's library-mode watch
      // re-emits the bundle in-place so the dev-mode connector
      // middleware (`/theme.js`) always serves the freshest output.
      // Without this the developer ends up running `numu-theme build`
      // manually after every change — a paper cut every theme dev
      // hits multiple times in their first hour.
      let watcher: ReturnType<typeof spawn> | null = null;
      if (options.watch) {
        console.log("Starting bundle watcher (vite build --watch)...");
        watcher = spawn(
          "npx",
          ["vite", "build", "--watch", "--mode", "development"],
          { stdio: "inherit", shell: true },
        );
      }

      // Forward exit codes — but if the watcher is in play, treat
      // the dev server's exit as the source of truth and tear the
      // watcher down with it. Reverse order would leave a stale Vite
      // building process the user has to hunt for in Activity Monitor.
      function shutdown(code: number) {
        if (watcher && !watcher.killed) {
          watcher.kill();
        }
        process.exit(code);
      }
      child.on("exit", (code) => shutdown(code ?? 0));
      // If the watcher dies first (e.g. fatal vite.config error), surface
      // it loudly and tear down the dev server too — the dev server
      // alone can't satisfy the dev-mode connector without a built
      // bundle.
      if (watcher) {
        watcher.on("exit", (code) => {
          if (code !== 0 && code !== null) {
            console.error(`Bundle watcher exited with code ${code}.`);
          }
          if (!child.killed) child.kill();
        });
      }
    },
  );
