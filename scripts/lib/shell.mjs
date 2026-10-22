// Comandi esterni per gli script di sviluppo (dev:all, test:e2e).

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

export const root = fileURLToPath(new URL("../..", import.meta.url));
export const isWindows = process.platform === "win32";

// Esegue un comando e risolve con { code, stdout }; non lancia mai eccezioni.
export const run = (command, args, { capture = false, env } = {}) =>
  new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: root,
      env: env ?? process.env,
      shell: isWindows, // npx e docker sono .cmd/.exe da risolvere tramite la shell
      stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit",
    });
    const chunks = [];
    child.stdout?.on("data", (chunk) => chunks.push(chunk));
    child.on("error", () => resolve({ code: 127, stdout: "" }));
    child.on("close", (code) => resolve({ code: code ?? 1, stdout: Buffer.concat(chunks).toString() }));
  });

export const supabase = (args, options) => run("npx", ["--yes", "supabase", ...args], options);

export const step = (message) => console.log(`\n▸ ${message}`);

export const fail = (message) => {
  console.error(`\n✖ ${message}`);
  process.exit(1);
};
