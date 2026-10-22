#!/usr/bin/env node
// `npm run test:e2e`: test end-to-end con Playwright sul Supabase locale.
// Avvia Supabase (se è spento), applica le migrazioni, azzera il database e lancia
// `playwright test`, che a sua volta compila l'app e la avvia su 127.0.0.1:3100
// insieme a un finto server per Google Books e Open Library.
//
// Il database locale viene azzerato: se contiene già utenti, lo script si ferma
// e chiede di ripetere con --reset (in CI l'azzeramento è automatico).
//
// Opzioni:
//   --reset   azzera il database locale anche se contiene dati
//   altri argomenti vanno a `playwright test` (es. `npm run test:e2e -- --ui`)

import { UNUSED_SERVICES, e2eEnv } from "./lib/local-env.mjs";
import { fail, run, step, supabase } from "./lib/shell.mjs";

const args = process.argv.slice(2);
const reset = args.includes("--reset") || Boolean(process.env.CI);
const playwrightArgs = args.filter((arg) => arg !== "--reset");

const readStatus = async () => {
  const status = await supabase(["status", "-o", "json"], { capture: true });
  return status.code === 0 ? e2eEnv(status.stdout) : { ok: false, error: "Supabase è spento." };
};

// Quanti membri ha l'istanza, letto con la chiave di servizio (che ignora la RLS).
const memberCount = async ({ E2E_SUPABASE_URL: url, E2E_SUPABASE_SECRET_KEY: key }) => {
  const response = await fetch(`${url}/rest/v1/members?select=user_id`, {
    headers: { apikey: key, Authorization: `Bearer ${key}`, Prefer: "count=exact", Range: "0-0" },
  }).catch(() => null);
  const total = response?.headers.get("content-range")?.split("/")[1];
  return total === undefined ? null : Number(total);
};

const wasRunning = (await readStatus()).ok;

if (!wasRunning) {
  step("Controllo Docker");
  if ((await run("docker", ["info"], { capture: true })).code !== 0) {
    fail("Docker non risponde. Avvia Docker Desktop (o Colima/OrbStack/Podman) e riprova.");
  }
  step("Avvio Supabase (la prima volta scarica le immagini Docker, qualche minuto)");
  if ((await supabase(["start", "--exclude", UNUSED_SERVICES.join(",")])).code !== 0) {
    fail("`supabase start` non è riuscito: vedi i messaggi sopra.");
  }
}

const env = await readStatus();
if (!env.ok) fail(env.error);

const members = await memberCount(env.value);
if (members !== 0 && !reset) {
  fail(
    "Il database locale contiene già dei dati e i test e2e lo azzerano.\n" +
      "  Per continuare comunque: npm run test:e2e -- --reset",
  );
}

step("Azzero il database locale e riapplico le migrazioni");
if ((await supabase(["db", "reset", "--local"])).code !== 0) {
  fail("`supabase db reset` non è riuscito: vedi i messaggi sopra.");
}

step("Lancio Playwright");
const tests = await run("npx", ["playwright", "test", ...playwrightArgs], {
  env: { ...process.env, ...env.value },
});

if (!wasRunning && !process.env.CI) {
  step("Fermo Supabase");
  await supabase(["stop"]);
}
process.exit(tests.code);
