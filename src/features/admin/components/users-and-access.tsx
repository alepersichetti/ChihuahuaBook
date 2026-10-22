"use client";

import { BookOpen, Library, MailPlus, Search, ShieldCheck, Trash2, UserCheck, UserX, type LucideIcon } from "lucide-react";
import { ResultAsync } from "neverthrow";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { roles, type Role } from "@/features/auth/viewer";
import { useI18n } from "@/features/i18n/i18n-context";
import { adminApi, type AdminError, type InstanceSettings, type Invitation, type Member } from "../api";
import { countByRole, initials, needsConfirmation, searchMembers } from "../members";

type Data = {
  readonly members: readonly Member[];
  readonly invitations: readonly Invitation[];
  readonly settings: InstanceSettings;
};

/** Una promozione ad amministratore in attesa di conferma. */
type Pending = { readonly userId: string; readonly role: Role };

const roleIcons: Readonly<Record<Role, LucideIcon>> = {
  reader: BookOpen,
  librarian: Library,
  admin: ShieldCheck,
};

const input = "h-9 rounded-lg border border-line-strong bg-surface px-2.5 text-sm text-ink";
const sectionTitle = "text-xs font-semibold tracking-wide text-muted uppercase";

const formatDate = (iso: string, locale: string) =>
  new Date(iso).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" });

const nameOf = (member: Member) => member.display_name || member.email;

/**
 * Utenti e ruoli, solo per amministratori. Chi entra è sempre Lettore;
 * da qui lo si promuove a Bibliotecario o Amministratore, si disattiva,
 * si invita. Il server ricontrolla tutto (API e RLS).
 */
export function UsersAndAccess({ currentUserId }: { currentUserId: string }) {
  const { t, locale } = useI18n();
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<AdminError | null>(null);
  const [query, setQuery] = useState("");
  const [pending, setPending] = useState<Pending | null>(null);

  const load = useCallback(
    () =>
      ResultAsync.combine([adminApi.members(), adminApi.invitations(), adminApi.settings()] as const).match(
        ([members, invitations, settings]) => setData({ members, invitations, settings }),
        setError,
      ),
    [],
  );

  useEffect(() => {
    // Primo caricamento: la risposta arriva dopo il montaggio.
    void load();
  }, [load]);

  const run = async (action: ResultAsync<unknown, AdminError>) => {
    const result = await action;
    setError(result.isOk() ? null : result.error);
    await load();
  };

  const changeRole = (member: Member, role: Role) => {
    if (role === member.role) return setPending(null);
    if (needsConfirmation(member.role, role)) return setPending({ userId: member.user_id, role });
    setPending(null);
    void run(adminApi.updateMember(member.user_id, { role }));
  };

  const confirm = (userId: string, role: Role) => {
    setPending(null);
    void run(adminApi.updateMember(userId, { role }));
  };

  const invite = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    void run(adminApi.invite(String(values.get("email") ?? ""))).then(() => form.reset());
  };

  if (!data) {
    return error ? (
      <p role="alert" className="text-sm text-danger">{t.admin.errors[error]}</p>
    ) : (
      <p className="text-sm text-muted" aria-busy="true">{t.common.loading}</p>
    );
  }

  const counts = countByRole(data.members);
  const visible = searchMembers(data.members, query);

  return (
    <div className="flex flex-col gap-8">
      {error && (
        <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
          {t.admin.errors[error]}
        </p>
      )}

      <ul className="flex flex-col gap-1.5">
        {roles.map((role) => {
          const Icon = roleIcons[role];
          return (
            <li key={role} className="flex items-center gap-3 rounded-xl bg-panel px-3 py-2">
              <Icon size={18} className="shrink-0 text-accent" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold">{t.roles[role]}</div>
                <div className="text-xs text-muted">{t.admin.roleHints[role]}</div>
              </div>
              <span className="shrink-0 text-xs text-muted tabular-nums">{t.admin.roleCount(counts[role])}</span>
            </li>
          );
        })}
      </ul>

      <section className="flex flex-col gap-3">
        <h2 className={sectionTitle}>{t.admin.members}</h2>
        {data.members.length > 4 && (
          <label className="relative flex items-center">
            <Search size={15} className="pointer-events-none absolute left-2.5 text-muted" aria-hidden="true" />
            <span className="sr-only">{t.admin.search}</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t.admin.search}
              className={`${input} w-full pl-8`}
            />
          </label>
        )}
        {visible.length === 0 ? (
          <p className="text-sm text-muted">{t.admin.noResults}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line rounded-xl border border-line">
            {visible.map((member) => {
              const self = member.user_id === currentUserId;
              const name = nameOf(member);
              const confirming = pending?.userId === member.user_id ? pending : null;
              return (
                <li key={member.user_id} className="flex flex-col gap-2.5 px-3 py-3">
                  <div className={`flex items-center gap-3 ${member.active ? "" : "opacity-60"}`}>
                    <span
                      aria-hidden="true"
                      className="flex size-9 shrink-0 items-center justify-center rounded-full bg-chip text-xs font-bold text-ink-soft"
                    >
                      {initials(member)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">
                        {name}
                        {self && <span className="ml-1.5 text-xs text-muted">{t.admin.you}</span>}
                      </div>
                      {member.display_name && <div className="truncate text-xs text-muted">{member.email}</div>}
                      {!member.active && <div className="text-xs font-semibold text-danger">{t.admin.deactivated}</div>}
                    </div>
                    {!self && (
                      <button
                        type="button"
                        onClick={() => void run(adminApi.updateMember(member.user_id, { active: !member.active }))}
                        aria-label={member.active ? t.admin.deactivate(name) : t.admin.reactivate(name)}
                        title={member.active ? t.admin.deactivate(name) : t.admin.reactivate(name)}
                        className="flex size-9 shrink-0 items-center justify-center rounded-lg text-ink-soft hover:bg-chip"
                      >
                        {member.active ? <UserX size={16} /> : <UserCheck size={16} />}
                      </button>
                    )}
                  </div>

                  <div
                    role="radiogroup"
                    aria-label={t.admin.roleOf(name)}
                    title={self ? t.admin.ownRole : undefined}
                    className="grid grid-cols-3 gap-1 rounded-lg bg-chip p-1"
                  >
                    {roles.map((role) => {
                      const checked = (confirming?.role ?? member.role) === role;
                      return (
                        <button
                          key={role}
                          type="button"
                          role="radio"
                          aria-checked={member.role === role}
                          disabled={self || !member.active}
                          onClick={() => changeRole(member, role)}
                          className={`h-8 truncate rounded-md px-1.5 text-xs font-semibold ${
                            checked ? "bg-surface text-accent shadow-sm" : "text-muted enabled:hover:text-ink"
                          } disabled:cursor-not-allowed`}
                        >
                          {t.roles[role]}
                        </button>
                      );
                    })}
                  </div>

                  {confirming && (
                    <div role="alertdialog" aria-label={t.admin.confirmAdmin(name)} className="flex flex-col gap-2 rounded-lg border border-accent bg-selected p-3">
                      <p className="text-sm">{t.admin.confirmAdmin(name)}</p>
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setPending(null)}
                          className="h-8 rounded-lg border border-line-strong px-3 text-sm hover:bg-chip"
                        >
                          {t.admin.cancel}
                        </button>
                        <button
                          type="button"
                          onClick={() => confirm(member.user_id, confirming.role)}
                          className="flex h-8 items-center gap-1.5 rounded-lg bg-accent px-3 text-sm font-medium text-accent-ink"
                        >
                          <ShieldCheck size={14} aria-hidden="true" />
                          {t.admin.promote}
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className={sectionTitle}>{t.admin.invitations}</h2>
        <form onSubmit={invite} className="flex items-end gap-2">
          <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
            {t.auth.email}
            <input name="email" type="email" required className={input} />
          </label>
          <button type="submit" className="flex h-9 items-center gap-1.5 rounded-lg bg-accent px-3 text-sm font-medium text-accent-ink">
            <MailPlus size={15} aria-hidden="true" />
            {t.admin.invite}
          </button>
        </form>
        <p className="text-xs text-muted">{t.admin.inviteHint}</p>
        {data.invitations.length > 0 && (
          <ul className="flex flex-col divide-y divide-line rounded-xl border border-line">
            {data.invitations.map((invitation) => (
              <li key={invitation.email} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                <div className="min-w-0 flex-1">
                  <div className="truncate">{invitation.email}</div>
                  <div className="text-xs text-muted">
                    {t.admin.invitationInfo(formatDate(invitation.expires_at, locale))}
                  </div>
                </div>
                <button
                  type="button"
                  aria-label={t.admin.revoke(invitation.email)}
                  onClick={() => void run(adminApi.revoke(invitation.email))}
                  className="flex size-9 items-center justify-center rounded-lg text-danger hover:bg-danger-soft"
                >
                  <Trash2 size={16} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className={sectionTitle}>{t.admin.signup}</h2>
        <label className="flex items-center gap-2.5 text-sm">
          <input
            type="checkbox"
            checked={data.settings.open_signup}
            onChange={(event) => void run(adminApi.updateSettings({ open_signup: event.target.checked }))}
            className="size-4 accent-accent"
          />
          {t.admin.openSignup}
        </label>
        <p className="text-xs text-muted">{t.admin.openSignupHint}</p>
      </section>
    </div>
  );
}
