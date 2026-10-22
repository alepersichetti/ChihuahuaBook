import { describe, expect, it } from "vitest";
import type { Member } from "./api";
import { countByRole, initials, needsConfirmation, searchMembers } from "./members";

const member = (overrides: Partial<Member>): Member => ({
  user_id: "id",
  email: "x@example.com",
  display_name: null,
  role: "reader",
  active: true,
  created_at: "",
  ...overrides,
});

const members = [
  member({ user_id: "1", email: "ale@example.com", display_name: "Alessio", role: "admin" }),
  member({ user_id: "2", email: "marta@example.com", display_name: "Marta Bellè", role: "librarian" }),
  member({ user_id: "3", email: "luca.rossi@example.com" }),
  member({ user_id: "4", email: "spento@example.com", active: false }),
];

describe("utenti e ruoli", () => {
  it("conta solo i membri attivi per ruolo", () => {
    expect(countByRole(members)).toEqual({ reader: 1, librarian: 1, admin: 1 });
  });

  it("cerca per nome o email, senza maiuscole né accenti", () => {
    expect(searchMembers(members, "belle").map((m) => m.user_id)).toEqual(["2"]);
    expect(searchMembers(members, " ROSSI ").map((m) => m.user_id)).toEqual(["3"]);
    expect(searchMembers(members, "")).toHaveLength(4);
  });

  it("ricava le iniziali dal nome o dall'email", () => {
    expect(initials(members[1])).toBe("MB");
    expect(initials(members[2])).toBe("LR");
  });

  it("chiede conferma solo per promuovere ad amministratore", () => {
    expect(needsConfirmation("reader", "admin")).toBe(true);
    expect(needsConfirmation("librarian", "admin")).toBe(true);
    expect(needsConfirmation("reader", "librarian")).toBe(false);
    expect(needsConfirmation("admin", "reader")).toBe(false);
  });
});
