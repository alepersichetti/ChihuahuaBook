import { describe, expect, it } from "vitest";
import type { PediaBook } from "@/server/core/books/pedia";
import { matchCovers } from "./covers";

const book = (sourceId: string, coverHints: string[]) =>
  ({ sourceId, coverHints, book: {}, extra: {} }) as unknown as PediaBook;

const image = (path: string, size = 10) => ({ path, blob: new Blob([new Uint8Array(size)]) });

describe("matchCovers", () => {
  it("abbina per nome del file (id, ISBN o titolo), ignorando maiuscole e accenti", () => {
    const books = [book("1", ["1"]), book("2", ["2", "Città invisibili"])];
    const images = [image("Covers/1.jpg"), image("Covers/citta invisibili.png"), image("Covers/altro.jpg")];
    const match = matchCovers(books, images);
    expect(match.method).toBe("name");
    expect(match.bySourceId.get("1")?.path).toBe("Covers/1.jpg");
    expect(match.bySourceId.get("2")?.path).toBe("Covers/citta invisibili.png");
    expect(match.unused.map((file) => file.path)).toEqual(["Covers/altro.jpg"]);
  });

  it("in mancanza di nomi utili usa la numerazione nell'ordine delle schede", () => {
    const books = [book("a", ["a"]), book("b", ["b"])];
    const match = matchCovers(books, [image("Covers/0.jpg"), image("Covers/1.jpg")]);
    expect(match.method).toBe("position");
    expect(match.bySourceId.get("b")?.path).toBe("Covers/1.jpg");
  });

  it("con più file per lo stesso nome sceglie il più grande", () => {
    const match = matchCovers([book("1", ["1"])], [image("big/1.jpg", 100), image("thumb/1.jpg", 5)]);
    expect(match.bySourceId.get("1")?.path).toBe("big/1.jpg");
  });
});
