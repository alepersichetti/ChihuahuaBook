import { describe, expect, it, vi } from "vitest";
import { removeColumn, renameColumn, saveColumns, saveFieldValue } from "./columns-api";
import type { CustomColumn } from "./model";

const reply = (status: number, body: unknown = {}) =>
  vi.fn(async () => new Response(status === 204 ? null : JSON.stringify(body), { status }));

const column: CustomColumn = { key: "premi", label: "Premi", kind: "text", catalogField: null, extraKey: "awards" };

describe("api colonne personalizzate", () => {
  it("manda le colonne nel formato del database", async () => {
    const fetcher = reply(200, []);
    expect(await saveColumns([column], { fetch: fetcher })).toBe("saved");
    const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/columns");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({
      columns: [{ key: "premi", label: "Premi", kind: "text", catalog_field: null, extra_key: "awards" }],
    });
  });

  it("senza colonne da salvare non chiama il server", async () => {
    const fetcher = reply(200);
    expect(await saveColumns([], { fetch: fetcher })).toBe("saved");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("senza server, senza accesso o con un libro di esempio la modifica resta nel browser", async () => {
    expect(await saveFieldValue("barone", "premi", "Strega", { fetch: reply(404) })).toBe("local");
    expect(await removeColumn("premi", { fetch: reply(401) })).toBe("local");
    expect(await saveColumns([column], { fetch: reply(500, { error: "misconfigured" }) })).toBe("local");
    expect(await saveColumns([column], { fetch: vi.fn(async () => Promise.reject(new Error("offline"))) })).toBe("local");
    expect(await saveColumns([column], { fetch: reply(403) })).toBe("failed");
  });

  it("rinomina con PATCH sulla chiave della colonna", async () => {
    const fetcher = reply(200, {});
    expect(await renameColumn("luogo d'acquisto", "Città", { fetch: fetcher })).toBe("saved");
    const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/columns/luogo%20d'acquisto");
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(String(init.body))).toEqual({ label: "Città" });
  });

  it("un valore vuoto toglie il campo", async () => {
    const fetcher = reply(204);
    expect(await saveFieldValue("b1", "premi", "  ", { fetch: fetcher })).toBe("saved");
    const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/books/b1/fields/premi");
    expect(JSON.parse(String(init.body))).toEqual({ value: null });
  });
});
