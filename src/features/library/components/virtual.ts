import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { visibleRange, type Range } from "../virtual-range";

// Con migliaia di libri il browser non regge un elemento per libro: si disegnano solo
// quelli visibili (più un margine) e due spaziatori tengono la barra di scorrimento giusta.

type Axis = "x" | "y";

type Options = {
  readonly count: number;
  /** Dimensione presunta di un elemento finché non se ne misura uno vero. */
  readonly estimate: number;
  /** Spazio tra un elemento e l'altro, che la misura non comprende. */
  readonly gap?: number;
  readonly overscan?: number;
  readonly axis?: Axis;
  /** Contenitore che scorre; senza, scorre la pagina. */
  readonly scrollRef?: RefObject<HTMLElement | null>;
  /** Dimensione fissa: niente misura (es. la galleria, dove il libro scelto è più grande). */
  readonly fixedSize?: number;
};

const start = (rect: DOMRect, axis: Axis) => (axis === "y" ? rect.top : rect.left);

/** Inizio e lunghezza della parte visibile, in coordinate della lista. */
const viewport = (list: HTMLElement, scroller: HTMLElement | null, axis: Axis) => {
  const listStart = start(list.getBoundingClientRect(), axis);
  if (!scroller) {
    return { offset: -listStart, size: axis === "y" ? window.innerHeight : window.innerWidth };
  }
  return {
    offset: start(scroller.getBoundingClientRect(), axis) - listStart,
    size: axis === "y" ? scroller.clientHeight : scroller.clientWidth,
  };
};

const sameRange = (a: Range, b: Range) => a.start === b.start && a.end === b.end;

export function useVirtualList<L extends HTMLElement>({
  count,
  estimate,
  gap = 0,
  overscan = 6,
  axis = "y",
  scrollRef,
  fixedSize,
}: Options) {
  // Callback ref in uno stato: chi usa l'hook non riceve oggetti ref da leggere durante il render.
  const [list, setList] = useState<L | null>(null);
  const [measured, setMeasured] = useState<number | null>(null);
  const itemSize = fixedSize ?? (measured ?? estimate) + gap;
  // Prima della misura si disegna una schermata abbondante: meglio qualche riga in più.
  const [range, setRange] = useState<Range>(() => visibleRange(count, itemSize, 0, 1200, overscan));

  const update = useCallback(() => {
    if (!list) return;
    const view = viewport(list, scrollRef?.current ?? null, axis);
    const next = visibleRange(count, itemSize, view.offset, view.size, overscan);
    setRange((current) => (sameRange(current, next) ? current : next));
  }, [axis, count, itemSize, list, overscan, scrollRef]);

  useLayoutEffect(update, [update]);

  useEffect(() => {
    const scroller = scrollRef?.current ?? null;
    let frame = 0;
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };
    const target: HTMLElement | Window = scroller ?? window;
    target.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    const observer = new ResizeObserver(schedule);
    if (scroller) observer.observe(scroller);
    return () => {
      cancelAnimationFrame(frame);
      target.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      observer.disconnect();
    };
  }, [scrollRef, update]);

  // Va sul primo elemento disegnato: la sua misura vale per tutti.
  const observer = useRef<ResizeObserver | null>(null);
  const measureItem = useCallback(
    (element: HTMLElement | null) => {
      observer.current?.disconnect();
      if (!element || fixedSize !== undefined) return;
      const measure = () => {
        const size = axis === "y" ? element.offsetHeight : element.offsetWidth;
        if (size > 0) setMeasured((current) => (current === size ? current : size));
      };
      measure();
      observer.current = new ResizeObserver(measure);
      observer.current.observe(element);
    },
    [axis, fixedSize],
  );

  /** Porta l'elemento `index` dentro la parte visibile, se ne è fuori. */
  const scrollToIndex = useCallback(
    (index: number) => {
      if (!list || index < 0) return;
      const scroller = scrollRef?.current ?? null;
      const view = viewport(list, scroller, axis);
      const itemStart = index * itemSize;
      const itemEnd = itemStart + itemSize - gap;
      const delta =
        itemStart < view.offset ? itemStart - view.offset : itemEnd > view.offset + view.size ? itemEnd - view.offset - view.size : 0;
      if (delta === 0) return;
      const options = axis === "y" ? { top: delta } : { left: delta };
      (scroller ?? window).scrollBy(options);
    },
    [axis, gap, itemSize, list, scrollRef],
  );

  /** Disegna subito la zona attorno a `index`, prima ancora di scorrere fin lì. */
  const drawAround = useCallback(
    (index: number) => {
      const size = list ? viewport(list, scrollRef?.current ?? null, axis).size : 1200;
      const next = visibleRange(count, itemSize, index * itemSize - size / 2, size, overscan);
      setRange((current) => (sameRange(current, next) ? current : next));
    },
    [axis, count, itemSize, list, overscan, scrollRef],
  );

  return {
    drawAround,
    /** Da passare come ref all'elemento che contiene la lista. */
    setList,
    measureItem,
    scrollToIndex,
    start: range.start,
    end: Math.min(range.end, count),
    /** Spazio prima del primo elemento disegnato e dopo l'ultimo. */
    before: range.start * itemSize,
    after: Math.max(0, count - Math.min(range.end, count)) * itemSize,
    itemSize,
  };
}
