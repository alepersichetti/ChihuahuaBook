#!/usr/bin/env node
// `npm run dev:all`: avvia Supabase in Docker, applica le migrazioni, prepara
// l'ambiente e lancia `next dev`. Con Ctrl+C ferma il server e poi Supabase.
// Unico prerequisito: Docker acceso. Funziona su macOS, Linux e Windows.
//
// Opzioni:
//   --keep-db   lascia Supabase acceso all'uscita (il riavvio dopo è immediato)
//   altri argomenti vanno a `next dev` (es. `npm run dev:all -- -p 3001`)

import { spawn } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
import { APP_URL, UNUSED_SERVICES, envFile, localUrls, nextDevArgs, supabaseEnv } from "./lib/local-env.mjs";
import { fail, isWindows, root, run, step, supabase } from "./lib/shell.mjs";

const args = process.argv.slice(2);
const keepDb = args.includes("--keep-db");
const nextArgs = args.filter((arg) => arg !== "--keep-db");

step("Controllo Docker");
if ((await run("docker", ["info"], { capture: true })).code !== 0) {
  fail("Docker non risponde. Avvia Docker Desktop (o Colima/OrbStack/Podman) e riprova.");
}

step("Avvio Supabase (la prima volta scarica le immagini Docker, qualche minuto)");
if ((await supabase(["start", "--exclude", UNUSED_SERVICES.join(",")])).code !== 0) {
  fail("`supabase start` non è riuscito: vedi i messaggi sopra.");
}

step("Applico le migrazioni nuove");
if ((await supabase(["migration", "up", "--local"])).code !== 0) {
  fail("Le migrazioni non sono state applicate: vedi i messaggi sopra.");
}

const status = await supabase(["status", "-o", "json"], { capture: true });
const env = supabaseEnv(status.stdout);
if (!env.ok) fail(env.error);

if (!existsSync(`${root}/.env.local`)) {
  writeFileSync(`${root}/.env.local`, envFile(env.value));
  console.log("\nCreato .env.local con l'indirizzo e la chiave del Supabase locale.");
}

console.log("\nPronto:");
localUrls(status.stdout).forEach(([name, url]) => console.log(`  ${name.padEnd(9)}${url}`));
console.log(`\nApri ${APP_URL}. Ctrl+C per fermare tutto.\n`);

// Le variabili del Supabase locale hanno la precedenza su .env.local (Next non sovrascrive
// quelle già presenti), così dev:all usa sempre lo stack locale; il resto di .env.local vale.
const next = spawn("npx", ["next", ...nextDevArgs(nextArgs)], {
  cwd: root,
  env: { ...process.env, ...env.value },
  shell: isWindows,
  stdio: "inherit",
});

// Ctrl+C arriva anche a `next dev`: qui aspettiamo che finisca e poi fermiamo Supabase.
const ignore = () => {};
process.on("SIGINT", ignore);
process.on("SIGTERM", () => next.kill("SIGTERM"));

const code = await new Promise((resolve) => next.on("close", (exit, signal) => resolve(signal ? 0 : (exit ?? 0))));

if (keepDb) {
  console.log("\nSupabase resta acceso (--keep-db). Per fermarlo: npx supabase stop");
} else {
  step("Fermo Supabase (i dati restano)");
  await supabase(["stop"]);
}
process.exit(code);
