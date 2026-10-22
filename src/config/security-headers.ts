// Header di sicurezza per tutte le risposte. Funzione pura: next.config.ts la usa
// su Next, ma la stessa lista va bene su qualunque altro hosting.

type Options = {
  readonly supabaseUrl?: string;
  readonly development: boolean;
};

const websocketOf = (url: string) => url.replace(/^http/, "ws");

/**
 * CSP senza nonce: Next inserisce script inline per l'idratazione, quindi
 * script-src ammette 'unsafe-inline' ma solo dalla nostra origine.
 * Il browser parla con Supabase (login, storage), le copertine arrivano da
 * cataloghi esterni via https.
 */
export const contentSecurityPolicy = ({ supabaseUrl, development }: Options) => {
  const supabase = supabaseUrl ? [supabaseUrl, websocketOf(supabaseUrl)] : [];
  const directives: Readonly<Record<string, readonly string[]>> = {
    "default-src": ["'self'"],
    "script-src": ["'self'", "'unsafe-inline'", ...(development ? ["'unsafe-eval'"] : [])],
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "blob:", "data:", "https:"],
    "font-src": ["'self'"],
    "connect-src": ["'self'", ...supabase, ...(development ? ["ws:"] : [])],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
  };
  return [
    ...Object.entries(directives).map(([name, values]) => `${name} ${values.join(" ")}`),
    ...(development ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
};

export const securityHeaders = (options: Options) => [
  { key: "Content-Security-Policy", value: contentSecurityPolicy(options) },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), payment=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];
