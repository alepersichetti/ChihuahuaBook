import { okAsync } from "neverthrow";
import { describe, expect, it, vi } from "vitest";
import type { Role } from "../core/auth/roles";
import type { MemberStore } from "../core/members/members";
import { adminRoutes, type AdminApiDeps } from "./admin-api";
import { router } from "./router";

const other = "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d";

const members = (overrides: Partial<MemberStore> = {}): MemberStore => ({
  list: () => okAsync([]),
  update: vi.fn(),
  invitations: () => okAsync([]),
  invite: (input) => okAsync({ ...input, created_at: "", expires_at: "" }),
  revoke: () => okAsync(undefined),
  settings: () => okAsync({ open_signup: false, language: "it" }),
  updateSettings: (patch) => okAsync({ open_signup: false, language: "it", ...patch }),
  ...overrides,
});

const app = (role: Role, store: MemberStore = members()) =>
  router<AdminApiDeps>("/api", adminRoutes, () => ({
    session: { viewer: () => okAsync({ userId: "me", role }) },
    members: store,
  }));

const call = (role: Role, method: string, path: string, body?: unknown) =>
  app(role)(
    new Request(`http://localhost${path}`, {
      method,
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  );

describe("admin API", () => {
  it("ogni membro sa chi è", async () => {
    const response = await call("reader", "GET", "/api/me");
    expect(await response.json()).toEqual({ userId: "me", role: "reader" });
  });

  it("solo l'admin gestisce utenti, inviti e impostazioni", async () => {
    const requests = [
      ["GET", "/api/admin/members"],
      ["PATCH", `/api/admin/members/${other}`, { role: "librarian" }],
      ["GET", "/api/admin/invitations"],
      ["POST", "/api/admin/invitations", { email: "a@example.com" }],
      ["DELETE", "/api/admin/invitations/a%40example.com"],
      ["GET", "/api/admin/settings"],
      ["PATCH", "/api/admin/settings", { open_signup: true }],
    ] as const;
    for (const role of ["reader", "librarian"] as const) {
      for (const [method, path, body] of requests) {
        expect((await call(role, method, path, body)).status).toBe(403);
      }
    }
  });

  it("l'admin invita e cambia le impostazioni", async () => {
    const invite = await call("admin", "POST", "/api/admin/invitations", {
      email: "Marta@Example.com",
    });
    expect(invite.status).toBe(201);
    expect(await invite.json()).toMatchObject({ email: "marta@example.com" });

    const settings = await call("admin", "PATCH", "/api/admin/settings", { open_signup: true });
    expect(await settings.json()).toMatchObject({ open_signup: true });
  });
});
