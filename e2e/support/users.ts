import type { Role } from "@/server/core/auth/roles";

export type TestUser = {
  readonly email: string;
  readonly password: string;
  readonly name: string;
  readonly role: Role;
  /** Sessione salvata dal setup, riusata dai test con `test.use({ storageState })`. */
  readonly storageState: string;
};

const user = (key: string, name: string, role: Role): TestUser => ({
  email: `${key}@example.com`,
  password: `Password-e2e-${key}-1`,
  name,
  role,
  storageState: `e2e/.auth/${key}.json`,
});

/** Il primo utente: si registra dalla pagina di accesso e conferma l'email da Mailpit. */
export const admin = user("admin", "Ada Admin", "admin");
export const librarian = user("bibliotecario", "Bruno Bibliotecario", "librarian");
export const reader = user("lettore", "Lia Lettrice", "reader");
/** Entra come lettore; il test sui ruoli lo promuove dal pannello delle Impostazioni. */
export const newcomer = user("nuovo", "Nino Nuovo", "reader");
