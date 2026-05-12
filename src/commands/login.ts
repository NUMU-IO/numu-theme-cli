import { Command } from "commander";
import inquirer from "inquirer";
import { saveConfig } from "../utils/config";
import { apiRequest } from "../utils/api";

interface LoginResponse {
  // Backend SuccessResponse.data shape after apiRequest unwraps the envelope:
  // { user, tokens: { access_token, refresh_token, token_type } }
  // OR (when 2FA is required): { requires_2fa: true, challenge_token: "..." }
  tokens?: {
    access_token?: string;
    refresh_token?: string;
    token_type?: string;
  };
  requires_2fa?: boolean;
  challenge_token?: string;
  detail?: string;
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
    // inquirer's "password" type masks the input — much better than a
    // raw readline prompt that echoes characters.
    const answers = await inquirer.prompt<{
      email: string;
      password: string;
    }>([
      {
        type: "input",
        name: "email",
        message: "Email:",
        validate: (v: string) => v.includes("@") || "Enter a valid email",
      },
      { type: "password", name: "password", message: "Password:", mask: "*" },
    ]);

    try {
      // apiRequest enforces https-or-localhost; throws if NUMU_API_URL is
      // an insecure remote host. The error message is preserved.
      const res = await apiRequest<LoginResponse>("POST", "/auth/login", {
        email: answers.email,
        password: answers.password,
      });
      if (res.status === 200 && res.data?.requires_2fa) {
        console.error(
          "\nLogin failed: this account has 2FA enabled. " +
            "The CLI cannot complete a 2FA challenge — generate an API token " +
            "in the dashboard and run `numu-theme login --token <token>`.",
        );
        process.exit(1);
      } else if (res.status === 200 && res.data?.tokens?.access_token) {
        saveConfig({ token: res.data.tokens.access_token });
        console.log("\n✓ Logged in successfully");
      } else {
        const detail = res.data?.detail ?? `HTTP ${res.status}`;
        console.error(`\nLogin failed: ${detail}`);
        process.exit(1);
      }
    } catch (err) {
      console.error(`\nLogin failed: ${(err as Error).message}`);
      process.exit(1);
    }
  });
