import { err, ok, type Result } from "neverthrow";
import type { z } from "zod";

export type ValidationIssue = {
  readonly path: string;
  readonly message: string;
};

/** Valida un input sconosciuto con uno schema zod e restituisce un Result invece di lanciare. */
export const validate =
  <S extends z.ZodType>(schema: S) =>
  (input: unknown): Result<z.output<S>, readonly ValidationIssue[]> => {
    const parsed = schema.safeParse(input);
    return parsed.success
      ? ok(parsed.data)
      : err(
          parsed.error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        );
  };
