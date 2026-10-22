import { errAsync, okAsync, type ResultAsync } from "neverthrow";
import { forbidden, type AppError } from "../errors";

/** Ruoli di un membro dell'istanza, dal meno al più potente. */
export const roles = ["reader", "librarian", "admin"] as const;

export type Role = (typeof roles)[number];

/** Chi sta usando l'app: un membro attivo con il suo ruolo. */
export type Viewer = {
  readonly userId: string;
  readonly role: Role;
};

/** Ruolo minimo per ogni tipo di operazione (lo stesso ordine vale nella RLS). */
export const requiredRole = {
  read: "reader",
  edit: "librarian",
  administer: "admin",
} as const satisfies Readonly<Record<string, Role>>;

export type Action = keyof typeof requiredRole;

export const isRole = (value: unknown): value is Role =>
  roles.includes(value as Role);

export const atLeast = (role: Role, minimum: Role): boolean =>
  roles.indexOf(role) >= roles.indexOf(minimum);

export const can = (role: Role, action: Action): boolean =>
  atLeast(role, requiredRole[action]);

/** Lascia passare il membro solo se il suo ruolo basta per l'azione. */
export const authorize =
  (action: Action) =>
  (viewer: Viewer): ResultAsync<Viewer, AppError> =>
    can(viewer.role, action) ? okAsync(viewer) : errAsync(forbidden);

export const roleLabels: Readonly<Record<Role, string>> = {
  reader: "Lettore",
  librarian: "Bibliotecario",
  admin: "Amministratore",
};
