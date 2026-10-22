"use client";

import {
  createContext,
  use,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type PointerEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { BookOpen, Folder } from "lucide-react";
import type { DropPlacement } from "./drag";
import { useFinePointer } from "./media";

// Trascinamento al tocco (iPad, tablet): il trascinamento nativo del browser non funziona
// bene con le dita, quindi si tiene premuto un libro o una collezione e lo si porta col dito.

export type DragPayload = { readonly kind: "book" | "collection"; readonly id: string; readonly label: string };

type Over = { readonly key: string; readonly placement: DropPlacement };

/** Chi riceve: dice dove finirebbe il rilascio (null se non è permesso) e lo esegue. */
export type DropHandler = {
  readonly accept: (payload: DragPayload, rect: DOMRect, clientY: number) => DropPlacement | null;
  readonly drop: (payload: DragPayload, placement: DropPlacement) => void;
};

type TouchDrag = {
  readonly payload: DragPayload | null;
  readonly over: Over | null;
  readonly start: (payload: DragPayload, x: number, y: number) => void;
  readonly register: (key: string, handler: RefObject<DropHandler>) => () => void;
};

const TouchDragContext = createContext<TouchDrag | null>(null);

export const useTouchDrag = () => {
  const value = use(TouchDragContext);
  if (!value) throw new Error("useTouchDrag va usato dentro TouchDragProvider");
  return value;
};

const pressDelay = 450;
const moveTolerance = 10;

const placeGhost = (ghost: HTMLElement | null, x: number, y: number) => {
  if (ghost) ghost.style.transform = `translate(${x - 24}px, ${y - 56}px)`;
};

export function TouchDragProvider({ children }: { children: ReactNode }) {
  const [payload, setPayload] = useState<DragPayload | null>(null);
  const [over, setOver] = useState<Over | null>(null);
  const handlers = useRef(new Map<string, RefObject<DropHandler>>());
  const ghost = useRef<HTMLDivElement>(null);
  const point = useRef({ x: 0, y: 0 });

  const register = useCallback((key: string, handler: RefObject<DropHandler>) => {
    handlers.current.set(key, handler);
    return () => void handlers.current.delete(key);
  }, []);

  const start = useCallback((next: DragPayload, x: number, y: number) => {
    point.current = { x, y };
    setPayload(next);
    navigator.vibrate?.(10);
  }, []);

  useEffect(() => {
    if (!payload) return;
    placeGhost(ghost.current, point.current.x, point.current.y);
    const targetAt = (x: number, y: number): Over | null => {
      const element = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-drop-target]");
      const key = element?.dataset.dropTarget;
      const handler = key ? handlers.current.get(key)?.current : undefined;
      const placement = element && handler ? handler.accept(payload, element.getBoundingClientRect(), y) : null;
      return key && placement ? { key, placement } : null;
    };
    const move = (event: globalThis.PointerEvent) => {
      point.current = { x: event.clientX, y: event.clientY };
      placeGhost(ghost.current, event.clientX, event.clientY);
      const next = targetAt(event.clientX, event.clientY);
      setOver((current) => (current?.key === next?.key && current?.placement === next?.placement ? current : next));
    };
    const finish = (event: globalThis.PointerEvent) => {
      const target = event.type === "pointerup" ? targetAt(event.clientX, event.clientY) : null;
      if (target) handlers.current.get(target.key)?.current.drop(payload, target.placement);
      setPayload(null);
      setOver(null);
    };
    // Mentre si trascina il dito non deve far scorrere la pagina.
    const holdPage = (event: TouchEvent) => event.preventDefault();
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", finish);
    window.addEventListener("pointercancel", finish);
    window.addEventListener("touchmove", holdPage, { passive: false });
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("pointercancel", finish);
      window.removeEventListener("touchmove", holdPage);
    };
  }, [payload]);

  const value = useMemo(() => ({ payload, over, start, register }), [payload, over, start, register]);
  const Icon = payload?.kind === "collection" ? Folder : BookOpen;
  return (
    <TouchDragContext value={value}>
      {children}
      {payload && (
        <div
          ref={ghost}
          aria-hidden="true"
          className="pointer-events-none fixed top-0 left-0 z-50 flex max-w-64 items-center gap-2 rounded-xl bg-accent px-3 py-2 text-sm font-semibold text-accent-ink shadow-xl"
        >
          <Icon size={16} className="shrink-0" />
          <span className="truncate">{payload.label}</span>
        </div>
      )}
    </TouchDragContext>
  );
}

/** Registra un punto di rilascio: la chiave va messa su `data-drop-target`. */
export const useDropTarget = (handler: DropHandler) => {
  const key = useId();
  const { register } = useTouchDrag();
  const latest = useRef(handler);
  useEffect(() => {
    latest.current = handler;
  });
  useEffect(() => register(key, latest), [key, register]);
  return key;
};

/**
 * Proprietà per ciò che si può trascinare col dito: tenendo premuto parte il trascinamento,
 * muovendo prima il dito si scorre la pagina come sempre.
 */
export const useTouchDragSource = () => {
  const { start } = useTouchDrag();
  const fine = useFinePointer();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragged = useRef(false);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  return (payload: DragPayload | null, onStart?: () => void) => {
    if (!payload) return {};
    return {
      style: { WebkitTouchCallout: "none", WebkitUserSelect: "none", userSelect: "none" } as const,
      onPointerDown: (event: PointerEvent) => {
        dragged.current = false;
        // Con il mouse basta il trascinamento nativo.
        if (event.pointerType === "mouse" && fine) return;
        const origin = { x: event.clientX, y: event.clientY };
        const stop = () => {
          if (timer.current) clearTimeout(timer.current);
          timer.current = null;
          window.removeEventListener("pointermove", wander);
          window.removeEventListener("pointerup", stop);
          window.removeEventListener("pointercancel", stop);
        };
        const wander = (move: globalThis.PointerEvent) => {
          if (Math.hypot(move.clientX - origin.x, move.clientY - origin.y) > moveTolerance) stop();
        };
        timer.current = setTimeout(() => {
          stop();
          dragged.current = true;
          onStart?.();
          start(payload, origin.x, origin.y);
        }, pressDelay);
        window.addEventListener("pointermove", wander);
        window.addEventListener("pointerup", stop);
        window.addEventListener("pointercancel", stop);
      },
      // Il tocco che ha trascinato non deve anche aprire il libro o la collezione.
      onClickCapture: (event: { preventDefault: () => void; stopPropagation: () => void }) => {
        if (!dragged.current) return;
        dragged.current = false;
        event.preventDefault();
        event.stopPropagation();
      },
      onContextMenu: (event: { preventDefault: () => void }) => {
        if (!fine) event.preventDefault();
      },
    };
  };
};
