"use client";

import { MailPlus, Trash2, UserCheck, UserX } from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { roleLabels, roles, type Role } from "@/features/auth/viewer";
import { adminApi, type ApiResult, type InstanceSettings, type Invitation, type Member } from "../api";

type Data = {
  readonly members: readonly Member[];
  readonly invitations: readonly Invitation[];
  readonly settings: InstanceSettings;
};

const input = "h-9 rounded-lg border border-line-strong bg-surface px-2.5 text-sm text-ink";
const sectionTitle = "text-xs font-semibold tracking-wide text-muted uppercase";

const formatDate = (iso: string) => new Date(iso).toLocaleDateString("it-IT", { day: "numeric", month: "short", year: "numeric" });

/**
 * Gestione degli accessi, solo per amministratori: ruoli e stato dei membri,
 * inviti e registrazione aperta. Il server ricontrolla tutto (API e RLS).
 */
export function UsersAndAccess({ currentUserId }: { currentUserId: string }) {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [members, invitations, settings] = await Promise.all([
      adminApi.members(),
      adminApi.invitations(),
      adminApi.settings(),
    ]);
    if (members.ok && invitations.ok && settings.ok) {
      setData({ members: members.value, invitations: invitations.value, settings: settings.value });
    } else {
      setError([members, invitations, settings].flatMap((result) => (result.ok ? [] : [result.message]))[0]);
    }
  }, []);

  useEffect(() => {
    // Primo caricamento: la risposta arriva dopo il montaggio.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const run = async (action: Promise<ApiResult<unknown>>) => {
    const result = await action;
    setError(result.ok ? null : result.message);
    await load();
  };

  const invite = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    void run(adminApi.invite(String(values.get("email") ?? ""), values.get("role") as Role)).then(() => form.reset());
  };

  if (!data) {
    return error ? (
      <p role="alert" className="text-sm text-danger">{error}</p>
    ) : (
      <p className="text-sm text-muted" aria-busy="true">Caricamento…</p>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {error && (
        <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      <section className="flex flex-col gap-3">
        <h2 className={sectionTitle}>Membri</h2>
        <ul className="flex flex-col divide-y divide-line rounded-xl border border-line">
          {data.members.map((member) => {
            const self = member.user_id === currentUserId;
            return (
              <li key={member.user_id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className={`min-w-0 flex-1 ${member.active ? "" : "opacity-60"}`}>
                  <div className="truncate text-sm font-medium">
                    {member.display_name || member.email}
                    {self && <span className="ml-1.5 text-xs text-muted">(tu)</span>}
                  </div>
                  {member.display_name && <div className="truncate text-xs text-muted">{member.email}</div>}
                  {!member.active && <div className="text-xs font-semibold text-danger">Disattivato</div>}
                </div>
                <label className="sr-only" htmlFor={`role-${member.user_id}`}>
                  Ruolo di {member.email}
                </label>
                <select
                  id={`role-${member.user_id}`}
                  value={member.role}
                  disabled={self}
                  title={self ? "Non puoi cambiare il tuo ruolo" : undefined}
                  onChange={(event) => void run(adminApi.updateMember(member.user_id, { role: event.target.value as Role }))}
                  className={input}
                >
                  {roles.map((role) => (
                    <option key={role} value={role}>
                      {roleLabels[role]}
                    </option>
                  ))}
                </select>
                {!self && (
                  <button
                    type="button"
                    onClick={() => void run(adminApi.updateMember(member.user_id, { active: !member.active }))}
                    className="flex h-9 items-center gap-1.5 rounded-lg border border-line-strong px-3 text-sm hover:bg-chip"
                  >
                    {member.active ? <UserX size={15} aria-hidden="true" /> : <UserCheck size={15} aria-hidden="true" />}
                    {member.active ? "Disattiva" : "Riattiva"}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className={sectionTitle}>Inviti</h2>
        <form onSubmit={invite} className="flex flex-wrap items-end gap-2">
          <label className="flex min-w-56 flex-1 flex-col gap-1 text-sm">
            Email
            <input name="email" type="email" required className={input} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Ruolo
            <select name="role" defaultValue="reader" className={input}>
              {roles.map((role) => (
                <option key={role} value={role}>
                  {roleLabels[role]}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="flex h-9 items-center gap-1.5 rounded-lg bg-accent px-3 text-sm font-medium text-accent-ink">
            <MailPlus size={15} aria-hidden="true" />
            Invita
          </button>
        </form>
        <p className="text-xs text-muted">
          L&apos;invito vale 14 giorni: la persona si registra dalla pagina di accesso con questa email e riceve il ruolo scelto.
        </p>
        {data.invitations.length > 0 && (
          <ul className="flex flex-col divide-y divide-line rounded-xl border border-line">
            {data.invitations.map((invitation) => (
              <li key={invitation.email} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                <div className="min-w-0 flex-1">
                  <div className="truncate">{invitation.email}</div>
                  <div className="text-xs text-muted">
                    {roleLabels[invitation.role]} · scade il {formatDate(invitation.expires_at)}
                  </div>
                </div>
                <button
                  type="button"
                  aria-label={`Annulla l'invito a ${invitation.email}`}
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

      <section className="flex flex-col gap-3">
        <h2 className={sectionTitle}>Registrazione</h2>
        <label className="flex items-center gap-2.5 text-sm">
          <input
            type="checkbox"
            checked={data.settings.open_signup}
            onChange={(event) => void run(adminApi.updateSettings({ open_signup: event.target.checked }))}
            className="size-4 accent-accent"
          />
          Chiunque può registrarsi senza invito
        </label>
        <label className="flex items-center gap-2.5 text-sm">
          Ruolo di chi si registra da solo
          <select
            value={data.settings.signup_role}
            disabled={!data.settings.open_signup}
            onChange={(event) =>
              void run(adminApi.updateSettings({ signup_role: event.target.value as InstanceSettings["signup_role"] }))
            }
            className={input}
          >
            <option value="reader">{roleLabels.reader}</option>
            <option value="librarian">{roleLabels.librarian}</option>
          </select>
        </label>
      </section>
    </div>
  );
}
