import { Command } from "commander";
import { saveConfig } from "../utils/config";
import { apiRequest } from "../utils/api";
import * as readline from "readline";

function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (answer) => { rl.close(); resolve(answer); }));
}

export const loginCommand = new Command("login")
  .description("Authenticate with the NUMU API")
  .option("--token <token>", "API token (skip interactive login)")
  .option("--api-url <url>", "Custom API URL")
  .action(async (options: { token?: string; apiUrl?: string }) => {
    if (options.apiUrl) {
      saveConfig({ api_url: options.apiUrl });
      console.log(`API URL set to: ${options.apiUrl}`);
    }

    if (options.token) {
      saveConfig({ token: options.token });
      console.log("✓ Token saved");
      return;
    }

    console.log("NUMU Theme Developer Login\n");
    const email = await prompt("Email: ");
    const password = await prompt("Password: ");

    try {
      const res = await apiRequest("POST", "/auth/login", { email, password });
      if (res.status === 200 && res.data?.access_token) {
        saveConfig({ token: res.data.access_token });
        console.log("\n✓ Logged in successfully");
      } else {
        console.error("\nLogin failed:", res.data?.detail || "Invalid credentials");
        process.exit(1);
      }
    } catch (err) {
      console.error("\nLogin failed:", err);
      process.exit(1);
    }
  });
