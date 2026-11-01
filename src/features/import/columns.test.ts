import { describe, expect, it } from "vitest";
import type { PediaRecord } from "@/server/core/books/pedia";
import { messages } from "../i18n/messages";
import type { CustomColumn } from "../library/model";
import { humanize, pediaColumns, pediaFieldValues } from "./columns";

const t = messages.it;

const record = (fields: Record<string, string | string[]>): PediaRecord =>
  Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, Array.isArray(value) ? value : [value]]));

// Come nell'export vero di Bookpedia: campi del catalogo, campi extra e caselle sempre a 0.
const records = [
  record({
    uid: "11866",
    title: "Il barone rampante",
    author: "Calvino Italo",
    publisher: "Einaudi",
    releaseDate: "1957-06-01T00:00:00Z",
    dateAdded: "2024-11-29T16:12:29Z",
    myRating: "0",
    status: "0",
    signed: "0",
    customCheckbox1: "0",
    translator: "Fruttero Carlo",
    edition: "I",
    placePublished: "Italia",
    dimensions: "8°",
    dogTag: "1021011",
    dateEdited: "2024-11-29T16:12:29Z",
    "Custom Field": "",
  }),
  record({
    uid: "11867",
    title: "Marcovaldo",
    author: "Calvino Italo",
    myRating: "0",
    status: "0",
    signed: "0",
    customCheckbox1: "0",
    translator: ["Uno", "Due"],
    editor: "Curatore",
    placePublished: "Inghilterra",
    dogTag: "2064131",
    awards: "Strega",
  }),
];

describe("humanize", () => {
  it("rende leggibili i nomi dei campi", () => {
    expect(humanize("placePublished")).toBe("Place Published");
    expect(humanize("custom_field")).toBe("Custom field");
    expect(humanize("customCheckbox1")).toBe("Custom Checkbox1");
  });
});

describe("pediaColumns", () => {
  const plan = pediaColumns(records, [], t);

  it("crea una colonna per ogni campo che la tabella non ha, con i nomi in italiano", () => {
    expect(plan.custom.map((column) => [column.key, column.label])).toEqual([
      ["status", "Stato"],
      ["signed", "Autografato"],
      ["customcheckbox1", "Casella 1"],
      ["translators", "Traduttore"],
      ["edition", "Edizione"],
      ["placepublished", "Luogo di pubblicazione"],
      ["dimensions", "Formato (dimensioni)"],
      ["dogtag", "Codice"],
      ["dateedited", "Modificato il"],
      ["customfield", "Custom Field"],
      ["editors", "Curatore"],
      ["awards", "Premi"],
    ]);
    expect(plan.added).toEqual(plan.custom);
  });

  it("i campi del catalogo leggono la colonna del libro, gli altri extra col nome del file", () => {
    const byKey = new Map(plan.custom.map((column) => [column.key, column]));
    expect(byKey.get("translators")).toMatchObject({ catalogField: "translators", extraKey: null });
    expect(byKey.get("signed")).toMatchObject({ catalogField: "signed", extraKey: null });
    expect(byKey.get("placepublished")).toMatchObject({ catalogField: null, extraKey: "placePublished" });
    expect(byKey.get("customfield")).toMatchObject({ extraKey: "Custom Field" });
  });

  it("riconosce date e numeri", () => {
    const kinds = Object.fromEntries(plan.custom.map((column) => [column.key, column.kind]));
    expect(kinds).toMatchObject({ dateedited: "date", dogtag: "number", placepublished: "text", customfield: "text" });
  });

  it("mostra solo le colonne con dati: fisse prima, poi quelle del file in ordine", () => {
    expect(plan.visible).toEqual([
      "title",
      "authors",
      "publishedYear",
      "publisher",
      "addedAt",
      "field:translators",
      "field:edition",
      "field:placepublished",
      "field:dimensions",
      "field:dogtag",
      "field:dateedited",
      "field:editors",
      "field:awards",
    ]);
    // Voto, stato e caselle sono sempre 0: le colonne esistono ma restano nascoste.
    expect(plan.visible).not.toContain("rating");
    expect(plan.visible).not.toContain("field:customcheckbox1");
  });

  it("riusa le colonne che la biblioteca ha già, con il loro nome e tipo", () => {
    const existing: CustomColumn = { key: "dimensions", label: "Formato", kind: "text", catalogField: null, extraKey: "dimensions" };
    const again = pediaColumns(records, [existing], t);
    expect(again.custom.find((column) => column.key === "dimensions")).toBe(existing);
    expect(again.added.map((column) => column.key)).not.toContain("dimensions");
    expect(again.added).toHaveLength(plan.added.length - 1);
  });

  it("un file senza campi in più non crea colonne", () => {
    const simple = pediaColumns([record({ title: "Dune", author: "Herbert Frank" })], [], t);
    expect(simple.custom).toEqual([]);
    expect(simple.visible).toEqual(["title", "authors"]);
  });
});

describe("pediaFieldValues", () => {
  it("dà a ogni libro i valori delle sue colonne", () => {
    const plan = pediaColumns(records, [], t);
    // Lo 0 delle caselle non spuntate non è un valore.
    expect(pediaFieldValues(records[0], plan)).toEqual({
      translators: "Fruttero Carlo",
      edition: "I",
      placepublished: "Italia",
      dimensions: "8°",
      dogtag: "1021011",
      dateedited: "2024-11-29T16:12:29Z",
    });
    expect(pediaFieldValues(records[1], plan)).toMatchObject({ translators: "Uno, Due", editors: "Curatore", awards: "Strega" });
  });
});
