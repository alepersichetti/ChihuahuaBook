import type { Messages } from "../i18n/messages";
import type { Collection } from "./model";

// Le etichette stanno nei testi tradotti (src/features/i18n/messages); qui solo ciò che dipende dai dati.

const systemKinds = new Set<Collection["kind"]>(["library", "loaned", "wishlist"]);

/** Le collezioni di sistema hanno il nome nella lingua dell'interfaccia; le altre quello scelto dall'utente. */
export const collectionName = (collection: Collection, t: Messages): string =>
  systemKinds.has(collection.kind)
    ? t.collections.system[collection.kind as "library" | "loaned" | "wishlist"]
    : collection.name;
