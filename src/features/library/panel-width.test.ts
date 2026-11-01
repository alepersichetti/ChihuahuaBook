import { describe, expect, it } from "vitest";
import {
  defaultPanelWidth,
  draggedWidth,
  keyedWidth,
  panelBounds,
  panelStep,
  panelWidth,
  parsePanelWidth,
} from "./panel-width";

describe("panelBounds", () => {
  it("lascia ai libri almeno 420 px sulle finestre strette", () => {
    expect(panelBounds(1024)).toEqual({ min: 260, max: 372 });
  });

  it("arriva a metà finestra sugli schermi larghi", () => {
    expect(panelBounds(1920)).toEqual({ min: 360, max: 960 });
    expect(panelBounds(1440)).toEqual({ min: 288, max: 720 });
  });

  it("non dà mai un massimo sotto il minimo", () => {
    const { min, max } = panelBounds(700);
    expect(max).toBe(min);
  });
});

describe("panelWidth", () => {
  const bounds = panelBounds(1440);

  it("parte da 340 px senza una scelta salvata", () => {
    expect(panelWidth(null, bounds)).toBe(defaultPanelWidth);
  });

  it("riporta la scelta dentro i limiti quando la finestra cambia", () => {
    expect(panelWidth(700, bounds)).toBe(700);
    expect(panelWidth(700, panelBounds(1024))).toBe(372);
    expect(panelWidth(100, bounds)).toBe(288);
  });
});

describe("draggedWidth", () => {
  const bounds = panelBounds(1440);

  it("si allarga trascinando verso sinistra e si stringe verso destra", () => {
    expect(draggedWidth(340, 1000, 900, bounds)).toBe(440);
    expect(draggedWidth(340, 1000, 1040, bounds)).toBe(300);
  });

  it("si ferma ai limiti", () => {
    expect(draggedWidth(340, 1000, 0, bounds)).toBe(720);
    expect(draggedWidth(340, 1000, 1400, bounds)).toBe(288);
  });
});

describe("keyedWidth", () => {
  const bounds = panelBounds(1440);

  it("le frecce spostano il bordo di un passo", () => {
    expect(keyedWidth("ArrowLeft", 340, bounds)).toBe(340 + panelStep);
    expect(keyedWidth("ArrowRight", 340, bounds)).toBe(340 - panelStep);
  });

  it("Home e Fine portano ai limiti, gli altri tasti non fanno nulla", () => {
    expect(keyedWidth("Home", 340, bounds)).toBe(288);
    expect(keyedWidth("End", 340, bounds)).toBe(720);
    expect(keyedWidth("Enter", 340, bounds)).toBeNull();
  });
});

describe("parsePanelWidth", () => {
  it("accetta solo numeri positivi", () => {
    expect(parsePanelWidth(420)).toBe(420);
    expect(parsePanelWidth(null)).toBeNull();
    expect(parsePanelWidth("420")).toBeNull();
    expect(parsePanelWidth(-5)).toBeNull();
    expect(parsePanelWidth(Number.NaN)).toBeNull();
  });
});
