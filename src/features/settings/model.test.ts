import { describe, expect, it } from "vitest";
import { canOpenSettings, defaultPreferences, hasRole, parsePreferences } from "./model";

describe("preferenze", () => {
  it("legge preferenze salvate valide", () => {
    expect(parsePreferences({ layout: "shelf", palette: "warm", coverSize: 180 })).toEqual({
      layout: "shelf",
      palette: "warm",
      coverSize: 180,
    });
  });

  it("scarta solo i campi non validi", () => {
    expect(parsePreferences({ layout: "nuovo", coverSize: 180 })).toEqual({ ...defaultPreferences, coverSize: 180 });
    expect(parsePreferences({ layout: "gallery", coverSize: 9999 })).toEqual({ ...defaultPreferences, layout: "gallery" });
    expect(parsePreferences("rotto")).toEqual(defaultPreferences);
  });

  it("ricava la palette dai vecchi layout che la includevano", () => {
    expect(parsePreferences({ layout: "warm" })).toMatchObject({ layout: "gallery", palette: "warm" });
    expect(parsePreferences({ layout: "shelf" })).toMatchObject({ layout: "shelf", palette: "dark" });
    expect(parsePreferences({ layout: "shelf", palette: "light" })).toMatchObject({ palette: "light" });
  });
});

describe("ruoli", () => {
  it("ordina i ruoli dal lettore all'amministratore", () => {
    expect(hasRole("admin", "librarian")).toBe(true);
    expect(hasRole("librarian", "admin")).toBe(false);
    expect(canOpenSettings("reader")).toBe(false);
    expect(canOpenSettings("librarian")).toBe(true);
  });
});
