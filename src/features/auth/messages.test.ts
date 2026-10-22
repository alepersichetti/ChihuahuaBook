import { describe, expect, it } from "vitest";
import { authErrorKey } from "./messages";

describe("errori di autenticazione", () => {
  it("il login fallito non dice se l'email esiste", () => {
    expect(authErrorKey({ message: "Invalid login credentials", code: "invalid_credentials" }, "signin")).toBe(
      "invalidCredentials",
    );
  });

  it("la registrazione rifiutata dal database spiega l'invito", () => {
    expect(authErrorKey({ message: "Database error saving new user", code: "unexpected_failure" }, "signup")).toBe(
      "inviteOnly",
    );
  });

  it("segnala i limiti di frequenza", () => {
    expect(authErrorKey({ message: "x", status: 429 }, "signin")).toBe("rateLimited");
  });
});
