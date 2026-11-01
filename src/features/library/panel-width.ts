// Larghezza della scheda del libro a destra (Tabella e Griglia): limiti e valori, senza DOM.

export type PanelBounds = { readonly min: number; readonly max: number };

/** Larghezza di partenza, quella che la scheda aveva prima che si potesse trascinare. */
export const defaultPanelWidth = 340;

/** Di quanto si allarga o si stringe con le frecce della tastiera. */
export const panelStep = 16;

// Spazio che resta agli altri: barra delle collezioni (fino a 232 px) e un elenco di libri leggibile.
const collectionsWidth = 232;
const minBooksWidth = 420;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/**
 * Limiti per una finestra larga `windowWidth`: la scheda va da un quinto (tra 260 e 360 px)
 * a metà della finestra, senza mai togliere ai libri meno di 420 px.
 */
export const panelBounds = (windowWidth: number): PanelBounds => {
  const min = clamp(Math.round(windowWidth * 0.2), 260, 360);
  const max = Math.min(Math.round(windowWidth / 2), windowWidth - collectionsWidth - minBooksWidth);
  return { min, max: Math.max(min, max) };
};

/** La larghezza voluta, riportata dentro i limiti; senza una scelta salvata vale quella di partenza. */
export const panelWidth = (wanted: number | null, bounds: PanelBounds) =>
  Math.round(clamp(wanted ?? defaultPanelWidth, bounds.min, bounds.max));

/**
 * Larghezza mentre si trascina il bordo sinistro: verso sinistra la scheda si allarga.
 * `startWidth` e `startX` sono quelli del momento in cui si è premuto.
 */
export const draggedWidth = (startWidth: number, startX: number, x: number, bounds: PanelBounds) =>
  panelWidth(startWidth + (startX - x), bounds);

/** Tasti della maniglia: frecce di un passo, Home e Fine ai limiti. `null` per gli altri tasti. */
export const keyedWidth = (key: string, width: number, bounds: PanelBounds): number | null => {
  switch (key) {
    case "ArrowLeft":
      return panelWidth(width + panelStep, bounds);
    case "ArrowRight":
      return panelWidth(width - panelStep, bounds);
    case "Home":
      return bounds.min;
    case "End":
      return bounds.max;
    default:
      return null;
  }
};

/** Valore salvato in localStorage: un numero positivo, altrimenti nessuna scelta. */
export const parsePanelWidth = (input: unknown): number | null =>
  typeof input === "number" && Number.isFinite(input) && input > 0 ? input : null;
