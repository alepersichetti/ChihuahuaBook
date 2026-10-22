import type { Role } from "@/server/core/auth/roles";

/** L'utente collegato, come lo vede l'interfaccia. */
export type SignedInViewer = {
  readonly userId: string;
  readonly email: string;
  readonly role: Role;
};

export type ViewerState =
  | { readonly status: "anonymous" }
  | { readonly status: "inactive"; readonly email: string }
  | ({ readonly status: "member" } & SignedInViewer);

export { can, roleLabels, roles } from "@/server/core/auth/roles";
export type { Role } from "@/server/core/auth/roles";
