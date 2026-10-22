import { z } from "zod";
import { coverSizes } from "../library/state";
import { layouts, palettes, type Layout, type Palette } from "../library/model";

// Preferenze personali: restano nel browser di chi le sceglie.
export type Preferences = {
  readonly layout: Layout;
  readonly palette: Palette;
  readonly coverSize: number;
};

export const defaultPreferences: Preferences = {
  layout: "classic",
  palette: "light",
  coverSize: coverSizes.initial,
};

// Un valore non valido (es. salvato da una versione precedente) torna al predefinito,
// campo per campo, invece di invalidare tutto.
const fieldOr = <T,>(schema: z.ZodType<T>, value: unknown, fallback: T): T => {
  const parsed = schema.safeParse(value);
  return parsed.success ? parsed.data : fallback;
};

const asRecord = (input: unknown): Record<string, unknown> =>
  typeof input === "object" && input !== null ? (input as Record<string, unknown>) : {};

const coverSizeSchema = z.number().int().min(coverSizes.min).max(coverSizes.max);

// Prima la palette era legata al layout ("warm" era un layout, "shelf" era sempre scuro)
// e "gallery" era un layout invece di una vista: chi aveva salvato quelle scelte
// ritrova gli stessi colori, con il layout classico.
const legacyPalette = (layout: unknown): Palette =>
  layout === "warm" ? "warm" : layout === "shelf" ? "dark" : defaultPreferences.palette;

export const parsePreferences = (input: unknown): Preferences => {
  const raw = asRecord(input);
  return {
    layout: fieldOr(z.enum(layouts), raw.layout === "warm" || raw.layout === "gallery" ? "classic" : raw.layout, defaultPreferences.layout),
    palette: fieldOr(z.enum(palettes), raw.palette, legacyPalette(raw.layout)),
    coverSize: fieldOr(coverSizeSchema, raw.coverSize, defaultPreferences.coverSize),
  };
};

// Ruoli: il lettore non vede le impostazioni, il bibliotecario una parte, l'amministratore tutto.
export const roles = ["reader", "librarian", "admin"] as const;
export type Role = (typeof roles)[number];

export const hasRole = (role: Role, minimum: Role) => roles.indexOf(role) >= roles.indexOf(minimum);

export const canOpenSettings = (role: Role) => hasRole(role, "librarian");
