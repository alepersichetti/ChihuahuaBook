import type { z } from "zod";

export type BookError =
  | { kind: "validation"; issues: z.core.$ZodIssue[] }
  | { kind: "not_found" }
  | { kind: "unauthenticated" }
  | { kind: "database"; message: string; code?: string };

export function databaseError(error: {
  message: string;
  code?: string;
}): BookError {
  return { kind: "database", message: error.message, code: error.code };
}
