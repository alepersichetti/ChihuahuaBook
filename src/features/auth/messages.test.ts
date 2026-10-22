import { describe, expect, it } from "vitest";
import { authErrorMessage } from "./messages";

describe("messaggi di autenticazione", () => {
  it("il login fallito non dice se l'email esiste", () => {
    expect(authErrorMessage({ message: "Invalid login credentials", code: "invalid_credentials" }, "signin")).toBe(
      "Email o password non corretti.",
    );
  });

  it("la registrazione rifiutata dal database spiega l'invito", () => {
    expect(authErrorMessage({ message: "Database error saving new user", code: "unexpected_failure" }, "signup")).toMatch(
      /invito/,
    );
  });

  it("segnala i limiti di frequenza", () => {
    expect(authErrorMessage({ message: "x", status: 429 }, "signin")).toMatch(/Troppi tentativi/);
  });
});
