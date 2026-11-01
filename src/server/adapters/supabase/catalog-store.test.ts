import { errAsync, okAsync } from "neverthrow";
import { describe, expect, it, vi } from "vitest";
import { readAllPages } from "./catalog-store";

describe("readAllPages", () => {
  const rows = Array.from({ length: 2500 }, (_, index) => index);

  it("legge pagina dopo pagina finché una arriva incompleta", async () => {
    const page = vi.fn((from: number, to: number) => okAsync(rows.slice(from, to + 1)));
    const all = await readAllPages(page, 1000);
    expect(all._unsafeUnwrap()).toHaveLength(2500);
    expect(page.mock.calls).toEqual([
      [0, 999],
      [1000, 1999],
      [2000, 2999],
    ]);
  });

  it("con un multiplo esatto chiede una pagina vuota e si ferma", async () => {
    const page = vi.fn((from: number, to: number) => okAsync(rows.slice(0, 2000).slice(from, to + 1)));
    expect((await readAllPages(page, 1000))._unsafeUnwrap()).toHaveLength(2000);
    expect(page).toHaveBeenCalledTimes(3);
  });

  it("un errore su una pagina ferma tutto", async () => {
    const page = (from: number) =>
      from === 0 ? okAsync(rows.slice(0, 1000)) : errAsync({ kind: "unexpected" as const, message: "timeout" });
    expect((await readAllPages(page, 1000))._unsafeUnwrapErr()).toEqual({ kind: "unexpected", message: "timeout" });
  });
});
