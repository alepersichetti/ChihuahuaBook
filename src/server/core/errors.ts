import type { ValidationIssue } from "./result";

export type AppError =
  | { readonly kind: "validation"; readonly issues: readonly ValidationIssue[] }
  | { readonly kind: "not_found" }
  | { readonly kind: "unauthenticated" }
  | { readonly kind: "conflict"; readonly message: string }
  | { readonly kind: "upstream"; readonly message: string }
  | { readonly kind: "unexpected"; readonly message: string };

export const validationError = (
  issues: readonly ValidationIssue[],
): AppError => ({ kind: "validation", issues });

export const notFound: AppError = { kind: "not_found" };
export const unauthenticated: AppError = { kind: "unauthenticated" };

export const unexpected = (cause: unknown): AppError => ({
  kind: "unexpected",
  message: cause instanceof Error ? cause.message : String(cause),
});
