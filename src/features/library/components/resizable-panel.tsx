"use client";

import { useState, useSyncExternalStore, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { useT } from "../../i18n/i18n-context";
import { localStore } from "../../settings/store";
import { draggedWidth, keyedWidth, panelBounds, panelWidth, parsePanelWidth } from "../panel-width";

// La larghezza scelta resta nel browser, come le altre preferenze di chi lo usa.
const widthStore = localStore("chihuahuabook:details-width", parsePanelWidth);

const subscribeResize = (onChange: () => void) => {
  window.addEventListener("resize", onChange);
  return () => window.removeEventListener("resize", onChange);
};

// Sul server si suppone una finestra da 1440 px; il browser corregge al primo disegno.
const useWindowWidth = () =>
  useSyncExternalStore(subscribeResize, () => window.innerWidth, () => 1440);

type Drag = { readonly startX: number; readonly startWidth: number; readonly width: number };

/**
 * Colonna destra di Tabella e Griglia, con il bordo sinistro da trascinare.
 * Minimo e massimo dipendono dalla finestra e si ricalcolano quando cambia.
 */
export function ResizablePanel({ children }: { readonly children: ReactNode }) {
  const t = useT();
  const bounds = panelBounds(useWindowWidth());
  const saved = useSyncExternalStore(widthStore.subscribe, widthStore.get, () => null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const width = drag ? drag.width : panelWidth(saved, bounds);

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setDrag({ startX: event.clientX, startWidth: width, width });
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (drag) setDrag({ ...drag, width: draggedWidth(drag.startWidth, drag.startX, event.clientX, bounds) });
  };
  const onPointerEnd = () => {
    if (!drag) return;
    widthStore.set(drag.width);
    setDrag(null);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const next = keyedWidth(event.key, width, bounds);
    if (next === null) return;
    event.preventDefault();
    widthStore.set(next);
  };

  return (
    <div className="relative flex shrink-0" style={{ width }} data-dragging={drag ? "" : undefined}>
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label={t.details.resize}
        aria-valuemin={bounds.min}
        aria-valuemax={bounds.max}
        aria-valuenow={width}
        tabIndex={0}
        title={t.details.resizeHint}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onKeyDown={onKeyDown}
        onDoubleClick={() => widthStore.set(null)}
        className={`group absolute inset-y-0 -left-[3px] z-10 w-[7px] cursor-col-resize touch-none outline-none ${
          drag ? "select-none" : ""
        }`}
      >
        <span
          aria-hidden="true"
          className={`absolute inset-y-0 left-[2px] w-[3px] rounded-full transition-colors ${
            drag ? "bg-accent" : "bg-transparent group-hover:bg-accent/60 group-focus-visible:bg-accent"
          }`}
        />
      </div>
      {children}
    </div>
  );
}
