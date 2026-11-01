import { describe, expect, it } from "vitest";
import { messages } from "../i18n/messages";
import {
  allColumns,
  bookFieldsFromRow,
  columnKeyOf,
  columnLabel,
  customColumnFromRow,
  customColumnId,
  customKeyOf,
  formatCustomValue,
  isCustomColumn,
  kindOfValues,
  mergeCustomColumns,
  newCustomColumn,
  renamedLabel,
} from "./columns";
import { columnKeys, type CustomColumn } from "./model";

const t = messages.it;

const column = (key: string, overrides: Partial<CustomColumn> = {}): CustomColumn => ({
  key,
  label: key,
  kind: "text",
  catalogField: null,
  extraKey: key,
  ...overrides,
});

describe("id delle colonne", () => {
  it("le colonne personalizzate hanno un prefisso che le separa da quelle fisse", () => {
    expect(customColumnId("dimensioni")).toBe("field:dimensioni");
    expect(isCustomColumn("field:dimensioni")).toBe(true);
    expect(isCustomColumn("title")).toBe(false);
    expect(customKeyOf("field:dimensioni")).toBe("dimensioni");
    expect(customKeyOf("authors")).toBeNull();
  });

  it("la chiave toglie maiuscole, accenti, spazi e punteggiatura", () => {
    expect(columnKeyOf("Luogo di pubblicazione")).toBe("luogodipubblicazione");
    expect(columnKeyOf("placePublished")).toBe("placepublished");
    expect(columnKeyOf("Città d'origine")).toBe("cittadorigine");
  });

  it("il nome è tradotto per le fisse e quello scelto per le personalizzate", () => {
    const custom = [column("dimensioni", { label: "Dimensioni" })];
    expect(columnLabel("authors", custom, t)).toBe("Autore");
    expect(columnLabel("authors", custom, messages.en)).toBe("Author");
    expect(columnLabel("field:dimensioni", custom, t)).toBe("Dimensioni");
    // Una colonna eliminata nel frattempo mostra almeno la chiave.
    expect(columnLabel("field:sparita", custom, t)).toBe("sparita");
  });

  it("il menu elenca prima le colonne fisse, poi le personalizzate", () => {
    expect(allColumns([column("a"), column("b")])).toEqual([...columnKeys, "field:a", "field:b"]);
  });
});

describe("newCustomColumn", () => {
  it("crea la colonna dal nome, con spazi ripuliti", () => {
    expect(newCustomColumn("  Luogo   di pubblicazione ", "text", [], t)).toEqual({
      ok: true,
      column: { key: "luogodipubblicazione", label: "Luogo di pubblicazione", kind: "text", catalogField: null, extraKey: "luogodipubblicazione" },
    });
  });

  it("rifiuta un nome vuoto o fatto solo di simboli", () => {
    expect(newCustomColumn("   ", "text", [], t)).toEqual({ ok: false, problem: "empty" });
    expect(newCustomColumn("!!!", "text", [], t)).toEqual({ ok: false, problem: "empty" });
  });

  it("rifiuta il nome di una colonna che c'è già, anche fissa", () => {
    expect(newCustomColumn("prezzo", "number", [column("prezzo")], t)).toEqual({ ok: false, problem: "exists" });
    expect(newCustomColumn("Titolo", "text", [], t)).toEqual({ ok: false, problem: "exists" });
    expect(newCustomColumn("Title", "text", [], messages.en)).toEqual({ ok: false, problem: "exists" });
  });
});

describe("renamedLabel", () => {
  const existing = [column("premi", { label: "Premi" }), column("placepublished", { label: "Luogo di pubblicazione" })];

  it("accetta un nome nuovo o lo stesso nome della colonna", () => {
    expect(renamedLabel("premi", " Premi  letterari ", existing, t)).toEqual({ ok: true, label: "Premi letterari" });
    expect(renamedLabel("premi", "premi", existing, t)).toEqual({ ok: true, label: "premi" });
  });

  it("rifiuta un nome vuoto o già usato da un'altra colonna", () => {
    expect(renamedLabel("premi", " ", existing, t)).toEqual({ ok: false, problem: "empty" });
    expect(renamedLabel("premi", "Luogo di pubblicazione", existing, t)).toEqual({ ok: false, problem: "exists" });
    expect(renamedLabel("premi", "placePublished", existing, t)).toEqual({ ok: false, problem: "exists" });
    expect(renamedLabel("premi", "Editore", existing, t)).toEqual({ ok: false, problem: "exists" });
  });

  it("anche una colonna nuova non può prendere il nome mostrato di un'altra", () => {
    expect(newCustomColumn("Luogo di pubblicazione", "text", existing, t)).toEqual({ ok: false, problem: "exists" });
  });
});

describe("mergeCustomColumns", () => {
  it("aggiunge solo le colonne nuove e lascia com'erano quelle esistenti", () => {
    const current = [column("prezzo", { label: "Prezzo", kind: "number" })];
    const merged = mergeCustomColumns(current, [column("prezzo", { label: "Price" }), column("premi"), column("premi")]);
    expect(merged).toEqual([current[0], column("premi")]);
  });

  it("senza novità restituisce lo stesso elenco", () => {
    const current = [column("prezzo")];
    expect(mergeCustomColumns(current, [column("prezzo")])).toBe(current);
  });
});

describe("tipo e formato dei valori", () => {
  it("riconosce date, numeri e testo", () => {
    expect(kindOfValues(["2024-11-29T16:12:29Z", "2020-01-02"])).toBe("date");
    expect(kindOfValues(["12", "3,5", " -4 "])).toBe("number");
    expect(kindOfValues(["12", "Euro 25,00"])).toBe("text");
    expect(kindOfValues(["", "  "])).toBe("text");
  });

  it("mostra date e numeri nella lingua dell'interfaccia", () => {
    expect(formatCustomValue("2024-11-29T16:12:29Z", "date", "it-IT")).toBe("29/11/2024");
    expect(formatCustomValue("2024-03-05", "date", "en-US")).toBe("3/5/2024");
    // Le date dei plist arrivano in ora locale: il giorno resta quello scritto.
    expect(formatCustomValue("2024-11-29T00:30:00", "date", "it-IT")).toBe("29/11/2024");
    expect(formatCustomValue("1234,5", "number", "it-IT")).toBe("1234,5");
    expect(formatCustomValue("1021011", "number", "en-US")).toBe("1021011");
    expect(formatCustomValue("3,25", "number", "en-US")).toBe("3.25");
    expect(formatCustomValue("non è un numero", "number", "it-IT")).toBe("non è un numero");
    expect(formatCustomValue(undefined, "text", "it-IT")).toBe("");
  });
});

describe("dal database", () => {
  it("una riga di custom_columns diventa una colonna", () => {
    expect(customColumnFromRow({ key: "premi", label: "Premi", kind: "text", catalog_field: null, extra_key: "awards" })).toEqual({
      key: "premi",
      label: "Premi",
      kind: "text",
      catalogField: null,
      extraKey: "awards",
    });
  });

  it("i valori vengono da extra o dal campo del catalogo", () => {
    const columns = [
      column("placepublished", { extraKey: "placePublished" }),
      column("dimensions", { extraKey: null }),
      column("translators", { catalogField: "translators", extraKey: null }),
      column("signed", { catalogField: "signed", extraKey: null }),
      column("vuota"),
    ];
    const row = {
      extra: { placePublished: "Italia", Dimensions: "8°", altro: "x" },
      translators: ["Calvino Italo", "Fruttero Carlo"],
      signed: false,
    };
    expect(bookFieldsFromRow(row, columns)).toEqual({
      placepublished: "Italia",
      dimensions: "8°",
      translators: "Calvino Italo, Fruttero Carlo",
    });
  });
});
