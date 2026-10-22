import { okAsync } from "neverthrow";
import {
  changeSettings,
  inviteMember,
  revokeInvitation,
  updateMember,
  type MemberStore,
} from "../core/members/members";
import type { Session } from "../core/session";
import { guarded, readJson } from "./guard";
import { route } from "./router";

export type AdminApiDeps = {
  readonly session: Session;
  readonly members: MemberStore;
};

const member = guarded<AdminApiDeps>("read");
const admin = guarded<AdminApiDeps>("administer");

export const adminRoutes = [
  // Chi sono e cosa posso fare: serve all'interfaccia per mostrare i comandi giusti.
  route<AdminApiDeps>(
    "GET",
    "/me",
    member((_context, viewer) => okAsync(viewer)),
  ),
  route<AdminApiDeps>(
    "GET",
    "/admin/members",
    admin(({ deps }) => deps.members.list()),
  ),
  route<AdminApiDeps>(
    "PATCH",
    "/admin/members/:id",
    admin(({ request, params, deps }, viewer) =>
      readJson(request).andThen((patch) =>
        updateMember(deps.members)(viewer, params.id, patch),
      ),
    ),
  ),
  route<AdminApiDeps>(
    "GET",
    "/admin/invitations",
    admin(({ deps }) => deps.members.invitations()),
  ),
  route<AdminApiDeps>(
    "POST",
    "/admin/invitations",
    admin(
      ({ request, deps }) =>
        readJson(request).andThen(inviteMember(deps.members)),
      201,
    ),
  ),
  route<AdminApiDeps>(
    "DELETE",
    "/admin/invitations/:email",
    admin(
      ({ params, deps }) => revokeInvitation(deps.members)(params.email),
      204,
    ),
  ),
  route<AdminApiDeps>(
    "GET",
    "/admin/settings",
    admin(({ deps }) => deps.members.settings()),
  ),
  route<AdminApiDeps>(
    "PATCH",
    "/admin/settings",
    admin(({ request, deps }, viewer) =>
      readJson(request).andThen((patch) =>
        changeSettings(deps.members)(viewer, patch),
      ),
    ),
  ),
] as const;
