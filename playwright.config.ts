import { defineConfig, devices } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { E2E_APP_URL, E2E_MOCK_URL, e2eEnv } from "./scripts/lib/local-env.mjs";

// Di solito le variabili arrivano da `npm run test:e2e`; lanciando `npx playwright test`
// direttamente si leggono dal Supabase locale acceso. I worker le ereditano da qui.
if (!process.env.E2E_SUPABASE_URL) {
  const status = (() => {
    try {
      return execFileSync("npx", ["--yes", "supabase", "status", "-o", "json"], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
        shell: process.platform === "win32",
      });
    } catch {
      return "";
    }
  })();
  const env = e2eEnv(status);
  if (!env.ok) throw new Error(`Supabase locale non raggiungibile (${env.error}). Usa \`npm run test:e2e\`.`);
  Object.assign(process.env, env.value);
}

const appEnv = {
  NEXT_PUBLIC_SUPABASE_URL: process.env.E2E_SUPABASE_URL ?? "",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.E2E_SUPABASE_KEY ?? "",
  // Le ricerche online vanno al finto server di e2e/mock-sources.mjs, mai ai cataloghi veri.
  GOOGLE_BOOKS_API_URL: `${E2E_MOCK_URL}/google/`,
  GOOGLE_BOOKS_API_KEY: "e2e",
  OPEN_LIBRARY_URL: `${E2E_MOCK_URL}/openlibrary/`,
};

export default defineConfig({
  testDir: "./e2e",
  // Database condiviso e libreria per scheda del browser: un test alla volta è più prevedibile.
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: E2E_APP_URL,
    locale: "it-IT",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
      dependencies: ["setup"],
    },
  ],
  webServer: [
    {
      command: "node e2e/mock-sources.mjs",
      url: `${E2E_MOCK_URL}/health`,
      reuseExistingServer: !process.env.CI,
    },
    {
      // Build di produzione, come su Vercel. Con E2E_DEV=1 usa `next dev` (più veloce mentre si scrivono i test).
      command: process.env.E2E_DEV
        ? "npx next dev --port 3100 --hostname 127.0.0.1"
        : "npm run build && npx next start --port 3100 --hostname 127.0.0.1",
      url: `${E2E_APP_URL}/login`,
      env: appEnv,
      timeout: 300_000,
      reuseExistingServer: !process.env.CI,
    },
  ],
});
