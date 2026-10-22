import { okAsync } from "neverthrow";
import { describe, expect, it, vi } from "vitest";
import type { SearchSource } from "./ports";
import { searchBooks, toSearchQuery } from "./search";

const source = (): SearchSource => ({
  id: "fake",
  label: "Finta",
  search: vi.fn(() => okAsync([])),
});

describe("toSearchQuery", () => {
  it("riconosce un ISBN scritto nella ricerca libera", () => {
    expect(toSearchQuery({ source: "fake", q: "88-452-9261-4", field: "any", limit: 20 })).toEqual({
      field: "isbn",
      text: "9788845292613",
      limit: 20,
    });
  });

  it("lascia il testo com'è negli altri casi", () => {
    expect(toSearchQuery({ source: "fake", q: "Eco", field: "author", limit: 5 })).toEqual({
      field: "author",
      text: "Eco",
      limit: 5,
    });
  });

  it("rifiuta un ISBN non valido nel campo ISBN", () => {
    expect(toSearchQuery({ source: "fake", q: "123", field: "isbn", limit: 5 })).toBeNull();
  });
});

describe("searchBooks", () => {
  it("passa la richiesta alla fonte scelta", async () => {
    const fake = source();
    const result = await searchBooks([fake])({ source: "fake", q: "Dune", field: "title" });
    expect(result.isOk()).toBe(true);
    expect(fake.search).toHaveBeenCalledWith({ field: "title", text: "Dune", limit: 20 });
  });

  it("segnala fonte sconosciuta, testo vuoto e ISBN non valido", async () => {
    const search = searchBooks([source()]);
    const issues = async (raw: unknown) => (await search(raw))._unsafeUnwrapErr();
    expect(await issues({ source: "altra", q: "x" })).toMatchObject({ issues: [{ path: "source" }] });
    expect(await issues({ source: "fake", q: " " })).toMatchObject({ issues: [{ path: "q" }] });
    expect(await issues({ source: "fake", q: "123", field: "isbn" })).toMatchObject({
      issues: [{ path: "q", message: "ISBN non valido" }],
    });
  });
});
