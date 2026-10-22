import { useSyncExternalStore } from "react";

const subscribe = (query: string) => (onChange: () => void) => {
  const list = window.matchMedia(query);
  list.addEventListener("change", onChange);
  return () => list.removeEventListener("change", onChange);
};

/** Vale la media query nel browser; sul server si suppone un computer con il mouse. */
export const useMedia = (query: string, onServer: boolean) =>
  useSyncExternalStore(subscribe(query), () => window.matchMedia(query).matches, () => onServer);

// Da 1024 px la barra laterale e la scheda del libro stanno affiancate ai libri.
export const useWide = () => useMedia("(min-width: 64rem)", true);

// Mouse o trackpad: trascinamento nativo del browser; altrimenti si tiene premuto col dito.
export const useFinePointer = () => useMedia("(pointer: fine)", true);
