// Quali elementi di una lista lunga cadono nella parte visibile: calcolo puro, senza DOM.

export type Range = { readonly start: number; readonly end: number };

/**
 * Elementi da disegnare, dall'indice `start` incluso a `end` escluso.
 * `offset` è quanto della lista è già passato sopra (o a sinistra), `size` quanto se ne vede.
 */
export const visibleRange = (
  count: number,
  itemSize: number,
  offset: number,
  size: number,
  overscan: number,
): Range => {
  if (count <= 0 || itemSize <= 0) return { start: 0, end: 0 };
  const first = Math.floor(Math.max(0, offset) / itemSize);
  const last = Math.ceil(Math.max(0, offset + size) / itemSize);
  const end = Math.min(count, last + overscan);
  return { start: Math.min(Math.max(0, first - overscan), end), end };
};

/** Quante colonne mette una griglia `repeat(auto-fill, minmax(min, 1fr))` larga `width`. */
export const gridColumns = (width: number, min: number, gap: number) =>
  Math.max(1, Math.floor((width + gap) / (min + gap)));

/** Divide i libri in righe da `columns`: la griglia si virtualizza per righe. */
export const chunk = <T,>(items: readonly T[], size: number): readonly (readonly T[])[] =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, row) => items.slice(row * size, (row + 1) * size));
