import { z } from "zod";
import { coverSizes } from "../library/state";
import { layouts, type Layout } from "../library/model";

// Preferenze personali: restano nel browser di chi le sceglie.
export type Preferences = {
  readonly layout: Layout;
  readonly coverSize: number;
};

export const defaultPreferences: Preferences = {
  layout: "classic",
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

export const parsePreferences = (input: unknown): Preferences => {
  const raw = asRecord(input);
  return {
    layout: fieldOr(z.enum(layouts), raw.layout, defaultPreferences.layout),
    coverSize: fieldOr(coverSizeSchema, raw.coverSize, defaultPreferences.coverSize),
  };
};

// Ruoli: il lettore non vede le impostazioni, il bibliotecario una parte, l'amministratore tutto.
export const roles = ["reader", "librarian", "admin"] as const;
export type Role = (typeof roles)[number];

export const hasRole = (role: Role, minimum: Role) => roles.indexOf(role) >= roles.indexOf(minimum);

export const canOpenSettings = (role: Role) => hasRole(role, "librarian");
