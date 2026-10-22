import { okAsync } from "neverthrow";
import { describe, expect, it } from "vitest";
import {
  changeSettings,
  inviteMember,
  updateMember,
  type Member,
  type MemberStore,
} from "./members";

const admin = { userId: "6f1c2d3e-4b5a-4c6d-8e7f-9a0b1c2d3e4f", role: "admin" } as const;
const other = "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d";

const echoUpdate: Pick<MemberStore, "update"> = {
  update: (user_id, patch) =>
    okAsync({ user_id, email: "x@example.com", display_name: null, role: "reader", active: true, created_at: "", ...patch } as Member),
};

const settings = { open_signup: false, signup_role: "reader", language: "it" } as const;

describe("membri", () => {
  it("l'admin cambia il ruolo di un altro membro", async () => {
    const result = await updateMember(echoUpdate)(admin, other, { role: "librarian" });
    expect(result._unsafeUnwrap()).toMatchObject({ user_id: other, role: "librarian" });
  });

  it("l'admin non può declassare o disattivare sé stesso", async () => {
    const demote = await updateMember(echoUpdate)(admin, admin.userId, { role: "reader" });
    expect(demote._unsafeUnwrapErr().kind).toBe("validation");
    const deactivate = await updateMember(echoUpdate)(admin, admin.userId, { active: false });
    expect(deactivate._unsafeUnwrapErr().kind).toBe("validation");
    const rename = await updateMember(echoUpdate)(admin, admin.userId, { display_name: "Ale" });
    expect(rename.isOk()).toBe(true);
  });

  it("rifiuta ruoli sconosciuti, campi estranei e modifiche vuote", async () => {
    for (const patch of [{ role: "owner" }, { email: "a@b.it" }, {}]) {
      const result = await updateMember(echoUpdate)(admin, other, patch);
      expect(result._unsafeUnwrapErr().kind).toBe("validation");
    }
  });

  it("normalizza l'email dell'invito", async () => {
    const result = await inviteMember({
      invite: (input) => okAsync({ ...input, created_at: "", expires_at: "" }),
    })({ email: " Marta@Example.COM ", role: "librarian" });
    expect(result._unsafeUnwrap()).toMatchObject({ email: "marta@example.com", role: "librarian" });
  });

  it("accetta solo le lingue previste", async () => {
    const store = { updateSettings: (patch: object) => okAsync({ ...settings, ...patch }) };
    expect((await changeSettings(store)(admin, { language: "en" }))._unsafeUnwrap().language).toBe("en");
    expect((await changeSettings(store)(admin, { language: "fr" }))._unsafeUnwrapErr().kind).toBe("validation");
  });

  it("la registrazione aperta non può dare il ruolo di admin", async () => {
    const result = await changeSettings({ updateSettings: () => okAsync(settings) })(admin, {
      signup_role: "admin",
    });
    expect(result._unsafeUnwrapErr().kind).toBe("validation");
  });

});
