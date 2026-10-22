import type { DragEvent } from "react";

// Trascinamento con l'API nativa del browser: un tipo per i libri e uno per le collezioni,
// così chi riceve capisce cosa sta arrivando già durante il passaggio, prima del rilascio.
export const bookMime = "application/x-chihuahuabook-book";
export const collectionMime = "application/x-chihuahuabook-collection";

export const carries = (event: DragEvent, mime: string) => event.dataTransfer.types.includes(mime);

/** Proprietà da spargere su un libro trascinabile con il mouse. */
export const draggableBook = (bookId: string) => ({
  draggable: true,
  onDragStart: (event: DragEvent) => {
    event.dataTransfer.setData(bookMime, bookId);
    event.dataTransfer.effectAllowed = "copy";
  },
});

export type DropPlacement = "before" | "inside" | "after";

/** Sopra o sotto la riga si inserisce accanto; al centro di una cartella si entra. */
export const placementIn = (rect: DOMRect, clientY: number, isFolder: boolean): DropPlacement => {
  const ratio = (clientY - rect.top) / Math.max(1, rect.height);
  if (!isFolder) return ratio < 0.5 ? "before" : "after";
  return ratio < 0.25 ? "before" : ratio > 0.75 ? "after" : "inside";
};

export const placementAt = (event: DragEvent<HTMLElement>, isFolder: boolean): DropPlacement =>
  placementIn(event.currentTarget.getBoundingClientRect(), event.clientY, isFolder);
