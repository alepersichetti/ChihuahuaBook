import { z } from "zod";

// Colonne personalizzate della biblioteca: definizione e valori nei libri.

export const columnKinds = ["text", "number", "date"] as const;

/** Campi del catalogo che una colonna può mostrare al posto di un valore libero. */
export const catalogFields = [
  "editors",
  "translators",
  "illustrators",
  "edition",
  "condition",
  "signed",
  "purchased_on",
  "purchased_from",
  "purchase_price",
  "estimated_value",
  "started_reading_on",
  "finished_reading_on",
  "favorite",
] as const;

export const columnKeySchema = z
  .string()
  .regex(/^[a-z0-9]{1,60}$/, "Solo lettere minuscole e cifre, al massimo 60");

export const columnInputSchema = z
  .object({
    key: columnKeySchema,
    label: z.string().trim().min(1).max(80),
    kind: z.enum(columnKinds).default("text"),
    catalog_field: z.enum(catalogFields).nullable().default(null),
    /** Chiave in books.extra, come nel file importato; senza, vale `key`. */
    extra_key: z.string().trim().min(1).max(200).nullable().default(null),
  })
  // I valori vengono o da extra o da un campo del catalogo, mai da entrambi.
  .transform((column) => ({
    ...column,
    extra_key: column.catalog_field === null ? (column.extra_key ?? column.key) : null,
  }));

/** Una o più colonne da creare: quelle che esistono già restano come sono. */
export const columnsInputSchema = z.object({
  columns: z.array(columnInputSchema).min(1).max(500),
});

export const fieldValueSchema = z.object({
  value: z.string().max(10_000).nullable(),
});

export type ColumnInput = z.output<typeof columnInputSchema>;

export type CustomColumn = ColumnInput & {
  readonly position: number;
  readonly created_at: string;
};
