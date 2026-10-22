import { describe, expect, it } from "vitest";
import { bookInputSchema, bookUpdateSchema } from "./schema";

describe("bookInputSchema", () => {
  it("applica i default e ripulisce i testi", () => {
    const book = bookInputSchema.parse({
      title: "  Il nome della rosa ",
      subtitle: "   ",
      authors: ["Umberto Eco", " "],
      isbn13: "978-88-452-9261-3",
    });
    expect(book).toMatchObject({
      title: "Il nome della rosa",
      subtitle: null,
      authors: ["Umberto Eco"],
      isbn13: "9788845292613",
      read_status: "unread",
      favorite: false,
      tags: [],
    });
  });

  it("rifiuta titolo vuoto, ISBN errato e voto fuori scala", () => {
    const result = bookInputSchema.safeParse({
      title: " ",
      isbn13: "9788845292614",
      rating: 7,
    });
    expect(result.success).toBe(false);
    const paths = result.error?.issues.map((issue) => issue.path.join("."));
    expect(paths).toEqual(
      expect.arrayContaining(["title", "isbn13", "rating"]),
    );
  });

  it("controlla l'ordine delle date di lettura", () => {
    const result = bookInputSchema.safeParse({
      title: "x",
      started_reading_on: "2026-02-01",
      finished_reading_on: "2026-01-01",
    });
    expect(result.success).toBe(false);
  });
});

describe("bookUpdateSchema", () => {
  it("accetta patch parziali senza applicare default", () => {
    expect(bookUpdateSchema.parse({ rating: 4 })).toEqual({ rating: 4 });
  });

  it("rifiuta una patch vuota", () => {
    expect(bookUpdateSchema.safeParse({}).success).toBe(false);
  });
});
