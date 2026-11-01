import { describe, expect, it } from "vitest";
import { chunk, gridColumns, visibleRange } from "./virtual-range";

describe("visibleRange", () => {
  it("disegna solo le righe visibili più il margine", () => {
    // Righe da 40 px, 400 px visibili, scorsi 4000 px: righe 100–110, più 5 per parte.
    expect(visibleRange(6400, 40, 4000, 400, 5)).toEqual({ start: 95, end: 115 });
  });

  it("in cima non va sotto zero e in fondo non supera il totale", () => {
    expect(visibleRange(6400, 40, -200, 400, 5)).toEqual({ start: 0, end: 10 });
    expect(visibleRange(30, 40, 4000, 400, 5)).toEqual({ start: 30, end: 30 });
  });

  it("lista vuota o dimensione non ancora nota: niente da disegnare", () => {
    expect(visibleRange(0, 40, 0, 400, 5)).toEqual({ start: 0, end: 0 });
    expect(visibleRange(10, 0, 0, 400, 5)).toEqual({ start: 0, end: 0 });
  });
});

describe("griglia", () => {
  it("conta le colonne come repeat(auto-fill, minmax(min, 1fr))", () => {
    // 5 copertine da 136 con 4 spazi da 20 = 760.
    expect(gridColumns(760, 136, 20)).toBe(5);
    expect(gridColumns(759, 136, 20)).toBe(4);
    expect(gridColumns(50, 136, 20)).toBe(1);
  });

  it("divide i libri in righe", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunk([], 3)).toEqual([]);
  });
});
