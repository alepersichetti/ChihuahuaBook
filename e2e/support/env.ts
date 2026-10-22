// Variabili preparate da `npm run test:e2e` (o da playwright.config.ts) a partire da `supabase status`.

const required = (name: string) => {
  const value = process.env[name];
  if (!value) throw new Error(`Manca ${name}: lancia i test con \`npm run test:e2e\`.`);
  return value;
};

export const env = {
  supabaseUrl: required("E2E_SUPABASE_URL"),
  supabaseKey: required("E2E_SUPABASE_KEY"),
  /** Chiave di servizio del Supabase locale: ignora la RLS, serve a preparare e controllare i dati. */
  secretKey: required("E2E_SUPABASE_SECRET_KEY"),
  mailpitUrl: required("E2E_MAILPIT_URL"),
};
