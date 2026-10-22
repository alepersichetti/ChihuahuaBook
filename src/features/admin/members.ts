import { roles, type Role } from "@/features/auth/viewer";
import type { Member } from "./api";

// Funzioni pure per il pannello Utenti e ruoli.

/** Quanti membri attivi ha ogni ruolo. */
export const countByRole = (members: readonly Member[]): Readonly<Record<Role, number>> =>
  Object.fromEntries(
    roles.map((role) => [role, members.filter((member) => member.active && member.role === role).length]),
  ) as Record<Role, number>;

const normalize = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

/** Filtra per nome o email, senza badare a maiuscole e accenti. */
export const searchMembers = (members: readonly Member[], query: string): readonly Member[] => {
  const needle = normalize(query.trim());
  return needle === ""
    ? members
    : members.filter((member) => normalize(`${member.display_name ?? ""} ${member.email}`).includes(needle));
};

/** Iniziali per l'avatar: dal nome se c'è, altrimenti dall'email. */
export const initials = (member: Pick<Member, "display_name" | "email">): string => {
  const words = (member.display_name?.trim() || member.email.split("@")[0]).split(/[\s._-]+/).filter(Boolean);
  return words
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
};

/** Diventare amministratore dà accesso a utenti e impostazioni: chiede una conferma. */
export const needsConfirmation = (from: Role, to: Role): boolean => to === "admin" && from !== "admin";
