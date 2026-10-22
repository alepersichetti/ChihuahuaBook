import { describe, expect, it } from "vitest";
import { isValidIsbn10, isValidIsbn13, parseIsbn } from "./isbn";

describe("isbn", () => {
  it("valida ISBN-13 e ISBN-10", () => {
    expect(isValidIsbn13("9788845292613")).toBe(true);
    expect(isValidIsbn13("9788845292614")).toBe(false);
    expect(isValidIsbn10("0306406152")).toBe(true);
    expect(isValidIsbn10("080442957X")).toBe(true);
    expect(isValidIsbn10("0306406153")).toBe(false);
  });

  it("normalizza trattini e spazi e ricava entrambe le forme", () => {
    expect(parseIsbn("978-88-452-9261-3")).toEqual({
      isbn13: "9788845292613",
      isbn10: "8845292614",
    });
    expect(parseIsbn("0-8044-2957-x")).toEqual({
      isbn13: "9780804429573",
      isbn10: "080442957X",
    });
  });

  it("non inventa un ISBN-10 per i codici 979", () => {
    expect(parseIsbn("9791032305690")).toEqual({
      isbn13: "9791032305690",
      isbn10: null,
    });
  });

  it("rifiuta input non validi", () => {
    expect(parseIsbn("")).toBeNull();
    expect(parseIsbn("abc")).toBeNull();
    expect(parseIsbn("1234567890123")).toBeNull();
  });
});
