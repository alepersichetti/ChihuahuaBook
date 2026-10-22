import { expect } from "@playwright/test";
import { env } from "./env";

// Mailpit raccoglie le email del Supabase locale: http://127.0.0.1:54324

type Summary = { readonly ID: string };

const latestTo = async (email: string): Promise<Summary | null> => {
  const query = encodeURIComponent(`to:"${email}"`);
  const response = await fetch(`${env.mailpitUrl}/api/v1/search?query=${query}`);
  if (!response.ok) return null;
  const { messages } = (await response.json()) as { messages: Summary[] };
  return messages[0] ?? null;
};

const decodeEntities = (text: string) => text.replaceAll("&amp;", "&").replaceAll("&#34;", '"').replaceAll("&#39;", "'");

/** Il link di conferma nell'ultima email arrivata a questo indirizzo (aspetta che arrivi). */
export const confirmationLink = async (email: string): Promise<string> => {
  await expect
    .poll(() => latestTo(email), { message: `nessuna email per ${email} in Mailpit`, timeout: 20_000 })
    .not.toBeNull();
  const summary = (await latestTo(email)) as Summary;
  const message = (await (await fetch(`${env.mailpitUrl}/api/v1/message/${summary.ID}`)).json()) as {
    HTML: string;
    Text: string;
  };
  const href = message.HTML.match(/href="([^"]*\/auth\/v1\/verify[^"]*)"/)?.[1] ?? message.Text.match(/https?:\/\/\S*\/auth\/v1\/verify\S*/)?.[0];
  if (!href) throw new Error(`Link di conferma non trovato nell'email per ${email}`);
  return decodeEntities(href);
};
