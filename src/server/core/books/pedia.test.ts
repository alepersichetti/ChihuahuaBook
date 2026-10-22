import { describe, expect, it } from "vitest";
import { mapPediaRecord, mapPediaRecords, parseDate, parseNumber } from "./pedia";

const record = (fields: Record<string, string | string[]>) =>
  Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [key, Array.isArray(value) ? value : [value]]),
  );

describe("mapPediaRecord", () => {
  it("riconosce i campi di Bookpedia e tiene da parte quelli sconosciuti", () => {
    const result = mapPediaRecord(
      record({
        Title: "Il barone rampante",
        Author: "Calvino Italo, Fruttero Carlo",
        Publisher: "Einaudi",
        "Release Date": "1957-06-01",
        ISBN: "88-06-17402-9",
        Pages: "283",
        Genre: "Romanzo, Classici",
        Rating: "8",
        Read: "1",
        "Date Read": "2020-03-04",
        Price: "€ 12,50",
        UID: "A1B2",
        "Custom Field": "qualcosa",
      }),
      0,
    )._unsafeUnwrap();

    expect(result.sourceId).toBe("A1B2");
    expect(result.book).toMatchObject({
      title: "Il barone rampante",
      authors: ["Calvino Italo", "Fruttero Carlo"],
      publisher: "Einaudi",
      published_year: 1957,
      isbn10: "8806174029",
      isbn13: "9788806174026",
      pages: 283,
      genres: ["Romanzo", "Classici"],
      rating: 4,
      read_status: "read",
      finished_reading_on: "2020-03-04",
      purchase_price: 12.5,
      currency: "EUR",
    });
    expect(result.extra).toEqual({ "Custom Field": "qualcosa" });
    expect(result.coverHints).toContain("A1B2");
  });

  it("divide più autori su righe separate o punto e virgola", () => {
    const result = mapPediaRecord(
      record({ title: "Good Omens", author: "Terry Pratchett\nNeil Gaiman; Neil Gaiman" }),
      0,
    )._unsafeUnwrap();
    expect(result.book.authors).toEqual(["Terry Pratchett", "Neil Gaiman"]);
  });

  it("un ISBN sbagliato non blocca il libro: finisce in extra", () => {
    const result = mapPediaRecord(record({ title: "X", isbn: "123" }), 0)._unsafeUnwrap();
    expect(result.book.isbn13).toBeNull();
    expect(result.extra).toEqual({ isbn: ["123"] });
  });

  it("scarta le schede senza titolo, con indice e motivo", () => {
    const error = mapPediaRecord(record({ author: "Anonimo" }), 7)._unsafeUnwrapErr();
    expect(error).toMatchObject({ index: 7, title: null, issues: [{ path: "title" }] });
  });
});

describe("mapPediaRecords", () => {
  it("dà un id stabile alle schede che non ne hanno e distingue le copie", () => {
    const records = [record({ title: "Dune" }), record({ title: "Dune" }), record({ title: "Emma" })];
    const first = mapPediaRecords(records).books.map((book) => book.sourceId);
    const again = mapPediaRecords(records).books.map((book) => book.sourceId);
    expect(first).toEqual(again);
    expect(new Set(first).size).toBe(3);
    expect(first[1]).toBe(`${first[0]}#2`);
  });
});

describe("conversioni", () => {
  it.each([
    ["2004-12-31", "2004-12-31"],
    ["2004-12-31T10:00:00Z", "2004-12-31"],
    ["31/12/2004", "2004-12-31"],
    ["12/31/2004", "2004-12-31"],
    ["Dec 12, 2004", "2004-12-12"],
    ["12 dic 2004", "2004-12-12"],
    ["31/02/2004", null],
    ["boh", null],
  ])("parseDate(%s) = %s", (raw, expected) => {
    expect(parseDate(raw)).toBe(expected);
  });

  it.each([
    ["12,50", 12.5],
    ["1.234,50 €", 1234.5],
    ["$1,234.50", 1234.5],
    ["abc", null],
  ])("parseNumber(%s) = %s", (raw, expected) => {
    expect(parseNumber(raw)).toBe(expected);
  });
});

describe("scheda reale di Bookpedia", () => {
  // Campi come compaiono nell'Info.xml di un .pedia (valori già convertiti in testo).
  const bookpedia = record({
    pediaKey: "1",
    author: "Fruttero Carlo, Lucentini Franco",
    customCheckbox1: "0",
    dateAdded: "2008-07-13T20:16:29",
    edition: "1ª ed.",
    format: "brossura",
    genre: "Saggio, Scienze Matematiche, Informatica",
    isbn: "9788804536451",
    localeLanguage: "it",
    myRating: "4",
    price: "Euro 25,00",
    purchasedOn: "2009-07-15T12:46:06",
    rating: "set 1968",
    releaseDate: "2004-07-01T00:00:00",
    status: "0",
    title: "Il culto del Mac",
    uid: "11866",
  });

  it("usa uid come id, il voto in decimi e le persone separate da virgole", () => {
    const result = mapPediaRecord(bookpedia, 0)._unsafeUnwrap();
    expect(result.sourceId).toBe("11866");
    expect(result.book).toMatchObject({
      authors: ["Fruttero Carlo", "Lucentini Franco"],
      rating: 2,
      published_year: 2004,
      purchased_on: "2009-07-15",
      purchase_price: 25,
      currency: "EUR",
      language: "it",
      read_status: "unread",
    });
    expect(result.extra).toMatchObject({ status: "0", ids: ["11866", "1"] });
    expect(result.coverHints.slice(0, 2)).toEqual(["11866", "1"]);
  });

  it("un voto 0 significa nessun voto", () => {
    const result = mapPediaRecord({ ...bookpedia, myRating: ["0"] }, 0)._unsafeUnwrap();
    expect(result.book.rating).toBeNull();
  });
});
