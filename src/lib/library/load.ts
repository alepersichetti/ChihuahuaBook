import "server-only";
import { connection } from "next/server";
import { libraryFromCatalog } from "@/features/library/catalog";
import type { Library } from "@/features/library/model";
import { sampleLibrary } from "@/features/library/sample-library";
import { supabaseCatalogStore } from "@/server/adapters/supabase/catalog-store";
import { createClient } from "@/lib/supabase/server";

// I dati di esempio servono solo senza Supabase (`npm run dev` per lavorare sull'interfaccia)
// o quando li si chiede esplicitamente, come fanno i test e2e: le loro prove su collezioni
// e cartelle partono da una biblioteca nota, non da quella nel database.
const wantsSample = () => process.env.LIBRARY_DATA === "sample";

/**
 * La biblioteca condivisa letta dal database, nella forma leggera adatta alla UI.
 * Un errore del database diventa un'eccezione: Next mostra la pagina d'errore
 * invece di una biblioteca vuota che sembrerebbe vera.
 */
export const loadLibrary = async (): Promise<Library> => {
  if (wantsSample()) return sampleLibrary;
  // Dati di ogni richiesta, mai prerenderizzati: supabase-js legge l'ora (Date.now)
  // per la scadenza della sessione, e con cacheComponents Next lo segnala come errore.
  await connection();
  const client = await createClient();
  if (client.isErr()) {
    if (process.env.NODE_ENV === "development") return sampleLibrary;
    throw new Error(`Configurazione mancante: ${client.error}`);
  }
  const catalog = await supabaseCatalogStore(client.value).load();
  return catalog.match(libraryFromCatalog, (error) => {
    throw new Error(`Lettura della biblioteca non riuscita: ${error.kind}${"message" in error ? ` (${error.message})` : ""}`);
  });
};
