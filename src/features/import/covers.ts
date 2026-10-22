import { normalizeKey, type PediaBook } from "@/server/core/books/pedia";
import type { BundleFile } from "./bundle";

export type CoverMatch = {
  /** sourceId del libro → file della copertina. */
  readonly bySourceId: ReadonlyMap<string, BundleFile>;
  /** "name": per nome del file (id, ISBN, titolo); "position": numerate nell'ordine delle schede. */
  readonly method: "name" | "position" | "none";
  readonly unused: readonly BundleFile[];
};

const baseName = (path: string) => path.split("/").pop()?.replace(/\.[a-z0-9]+$/i, "") ?? path;

const keyOfFile = (file: BundleFile) => normalizeKey(baseName(file.path));

const byName = (books: readonly PediaBook[], images: readonly BundleFile[]) => {
  // Con più file per lo stesso nome vince il più grande (di solito la copertina, non la miniatura).
  const index = new Map(
    images
      .toSorted((a, b) => a.blob.size - b.blob.size)
      .map((file) => [keyOfFile(file), file] as const),
  );
  return new Map(
    books.flatMap((book) => {
      const file = book.coverHints
        .map((hint) => index.get(normalizeKey(hint)))
        .find((found) => found !== undefined);
      return file ? [[book.sourceId, file] as const] : [];
    }),
  );
};

// Ripiego: copertine chiamate 1.jpg, 2.jpg... nello stesso ordine delle schede.
const byPosition = (books: readonly PediaBook[], images: readonly BundleFile[]) => {
  const numbered = images.flatMap((file) => {
    const name = baseName(file.path);
    return /^\d+$/.test(name) ? [{ number: Number(name), file }] : [];
  });
  if (numbered.length === 0 || numbered.length !== images.length) return new Map<string, BundleFile>();
  const start = Math.min(...numbered.map(({ number }) => number));
  const fileAt = new Map(numbered.map(({ number, file }) => [number - start, file] as const));
  return new Map(
    books.flatMap((book, position) => {
      const file = fileAt.get(position);
      return file ? [[book.sourceId, file] as const] : [];
    }),
  );
};

/** Abbina le immagini del bundle ai libri. */
export const matchCovers = (books: readonly PediaBook[], images: readonly BundleFile[]): CoverMatch => {
  const named = byName(books, images);
  const positional = named.size === 0 ? byPosition(books, images) : new Map<string, BundleFile>();
  const bySourceId = named.size > 0 ? named : positional;
  const used = new Set(bySourceId.values());
  return {
    bySourceId,
    method: named.size > 0 ? "name" : positional.size > 0 ? "position" : "none",
    unused: images.filter((file) => !used.has(file)),
  };
};
