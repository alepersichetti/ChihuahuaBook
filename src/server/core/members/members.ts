import { errAsync, type ResultAsync } from "neverthrow";
import { z } from "zod";
import type { Role, Viewer } from "../auth/roles";
import { roles } from "../auth/roles";
import { validationError, type AppError } from "../errors";
import { validate } from "../result";

// Membri, inviti e impostazioni dell'istanza. I permessi li controllano
// le rotte HTTP (authorize) e, di nuovo, la RLS del database.

export type Member = {
  readonly user_id: string;
  readonly email: string;
  readonly display_name: string | null;
  readonly role: Role;
  readonly active: boolean;
  readonly created_at: string;
};

export type Invitation = {
  readonly email: string;
  readonly role: Role;
  readonly created_at: string;
  readonly expires_at: string;
};

/** Lingue dell'interfaccia; la sceglie l'amministratore per tutta l'istanza. */
export const instanceLanguages = ["it", "en"] as const;

export type InstanceLanguage = (typeof instanceLanguages)[number];

export type InstanceSettings = {
  readonly open_signup: boolean;
  readonly signup_role: Exclude<Role, "admin">;
  readonly language: InstanceLanguage;
};

const roleSchema = z.enum(roles);

export const memberIdSchema = z.uuid();

export const memberPatchSchema = z
  .object({
    role: roleSchema.optional(),
    active: z.boolean().optional(),
    display_name: z.string().trim().max(100).nullable().optional(),
  })
  .strict()
  .refine((patch) => Object.keys(patch).length > 0, "Nessuna modifica");

export type MemberPatch = z.output<typeof memberPatchSchema>;

export const invitationInputSchema = z
  .object({
    email: z.string().trim().toLowerCase().pipe(z.email()),
    role: roleSchema.default("reader"),
  })
  .strict();

export type InvitationInput = z.output<typeof invitationInputSchema>;

export const settingsPatchSchema = z
  .object({
    open_signup: z.boolean().optional(),
    signup_role: z.enum(["reader", "librarian"]).optional(),
    language: z.enum(instanceLanguages).optional(),
  })
  .strict()
  .refine((patch) => Object.keys(patch).length > 0, "Nessuna modifica");

export type SettingsPatch = z.output<typeof settingsPatchSchema>;

/** Porta verso membri, inviti e impostazioni. */
export type MemberStore = {
  readonly list: () => ResultAsync<readonly Member[], AppError>;
  readonly update: (
    userId: string,
    patch: MemberPatch,
  ) => ResultAsync<Member, AppError>;
  readonly invitations: () => ResultAsync<readonly Invitation[], AppError>;
  readonly invite: (
    input: InvitationInput,
  ) => ResultAsync<Invitation, AppError>;
  readonly revoke: (email: string) => ResultAsync<void, AppError>;
  readonly settings: () => ResultAsync<InstanceSettings, AppError>;
  readonly updateSettings: (
    patch: SettingsPatch,
    by: string,
  ) => ResultAsync<InstanceSettings, AppError>;
};

const selfLockout = validationError([
  {
    path: "role",
    message: "Non puoi togliere a te stesso il ruolo di amministratore",
  },
]);

/**
 * Cambia ruolo o stato di un membro. Un admin non può declassare o
 * disattivare sé stesso: eviterebbe di restare fuori per errore
 * (il database impedisce comunque di togliere l'ultimo admin).
 */
export const updateMember =
  (store: Pick<MemberStore, "update">) =>
  (
    viewer: Viewer,
    id: unknown,
    patch: unknown,
  ): ResultAsync<Member, AppError> =>
    validate(memberIdSchema)(id)
      .andThen((userId) =>
        validate(memberPatchSchema)(patch).map(
          (valid) => [userId, valid] as const,
        ),
      )
      .mapErr(validationError)
      .asyncAndThen(([userId, valid]) =>
        userId === viewer.userId &&
        ((valid.role !== undefined && valid.role !== "admin") ||
          valid.active === false)
          ? errAsync(selfLockout)
          : store.update(userId, valid),
      );

export const inviteMember =
  (store: Pick<MemberStore, "invite">) =>
  (input: unknown): ResultAsync<Invitation, AppError> =>
    validate(invitationInputSchema)(input)
      .mapErr(validationError)
      .asyncAndThen(store.invite);

export const revokeInvitation =
  (store: Pick<MemberStore, "revoke">) =>
  (email: unknown): ResultAsync<void, AppError> =>
    validate(z.string().trim().toLowerCase().pipe(z.email()))(email)
      .mapErr(validationError)
      .asyncAndThen(store.revoke);

export const changeSettings =
  (store: Pick<MemberStore, "updateSettings">) =>
  (viewer: Viewer, patch: unknown): ResultAsync<InstanceSettings, AppError> =>
    validate(settingsPatchSchema)(patch)
      .mapErr(validationError)
      .asyncAndThen((valid) => store.updateSettings(valid, viewer.userId));
