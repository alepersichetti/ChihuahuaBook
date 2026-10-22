import { describe, expect, it } from "vitest";
import { emptyForm, formFromDraft, validateForm } from "./form";

describe("modulo libro", () => {
  it("riempie il modulo da una bozza e la riconverte", () => {
    const form = formFromDraft({
      title: "Il nome della rosa",
      authors: ["Umberto Eco"],
      publisher: "Bompiani",
      published_year: 2012,
      isbn13: "9788845292613",
      pages: 503,
      genres: ["Romanzo", "Giallo"],
      cover_url: "https://example.com/c.jpg",
    });
    expect(form).toMatchObject({ authors: "Umberto Eco", year: "2012", isbn: "9788845292613", genres: "Romanzo, Giallo" });

    const result = validateForm(form);
    expect(result).toMatchObject({
      ok: true,
      book: {
        title: "Il nome della rosa",
        authors: ["Umberto Eco"],
        published_year: 2012,
        isbn13: "9788845292613",
        isbn10: "8845292614",
        pages: 503,
        genres: ["Romanzo", "Giallo"],
        read_status: "unread",
      },
    });
  });

  it("segnala i campi sbagliati con i messaggi dello schema", () => {
    expect(validateForm(emptyForm)).toEqual({ ok: false, issues: { title: "Il titolo è obbligatorio" } });
    expect(validateForm({ ...emptyForm, title: "X", isbn: "123" })).toEqual({
      ok: false,
      issues: { isbn: "ISBN non valido" },
    });
    const pages = validateForm({ ...emptyForm, title: "X", pages: "abc" });
    expect(pages.ok ? null : Object.keys(pages.issues)).toEqual(["pages"]);
  });
});
