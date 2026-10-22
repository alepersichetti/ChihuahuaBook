"use client";

import { KeyRound } from "lucide-react";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { useT } from "@/features/i18n/i18n-context";
import { authErrorKey } from "../messages";
import { fieldClass, inputClass, primaryButtonClass } from "./auth-card";

type Status = { readonly kind: "idle" | "busy" | "done" } | { readonly kind: "error"; readonly text: string };

export function PasswordForm() {
  const t = useT();
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const password = String(data.get("password") ?? "");
    if (password !== String(data.get("confirm") ?? ""))
      return setStatus({ kind: "error", text: t.auth.passwordsDiffer });
    const client = createClient();
    if (client.isErr()) return setStatus({ kind: "error", text: t.auth.errors.generic });
    setStatus({ kind: "busy" });
    const { error } = await client.value.auth.updateUser({ password });
    setStatus(error ? { kind: "error", text: t.auth.errors[authErrorKey(error, "password")] } : { kind: "done" });
  };

  if (status.kind === "done") {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <p role="status" className="rounded-lg bg-ok-soft px-3 py-2 text-sm text-ok">
          {t.auth.passwordUpdated}
        </p>
        <Link href="/" className={primaryButtonClass}>
          {t.auth.toCatalogue}
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <h2 className="text-center text-lg font-semibold">{t.auth.newPasswordTitle}</h2>
      <label className={fieldClass}>
        {t.auth.newPassword}
        <input name="password" type="password" required minLength={10} autoComplete="new-password" autoFocus className={inputClass} />
      </label>
      <label className={fieldClass}>
        {t.auth.repeatPassword}
        <input name="confirm" type="password" required minLength={10} autoComplete="new-password" className={inputClass} />
      </label>
      {status.kind === "error" && (
        <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
          {status.text}
        </p>
      )}
      <button type="submit" disabled={status.kind === "busy"} className={primaryButtonClass}>
        <KeyRound size={16} aria-hidden="true" />
        {t.common.save}
      </button>
      <Link href="/" className="text-center text-sm text-muted hover:underline">
        {t.common.cancel}
      </Link>
    </form>
  );
}
