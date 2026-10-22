"use client";

import { KeyRound } from "lucide-react";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { authErrorMessage } from "../messages";
import { fieldClass, inputClass, primaryButtonClass } from "./auth-card";

type Status = { readonly kind: "idle" | "busy" | "done" } | { readonly kind: "error"; readonly text: string };

export function PasswordForm() {
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const password = String(data.get("password") ?? "");
    if (password !== String(data.get("confirm") ?? ""))
      return setStatus({ kind: "error", text: "Le due password non coincidono." });
    setStatus({ kind: "busy" });
    const { error } = await createClient().auth.updateUser({ password });
    setStatus(error ? { kind: "error", text: authErrorMessage(error, "password") } : { kind: "done" });
  };

  if (status.kind === "done") {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <p role="status" className="rounded-lg bg-ok-soft px-3 py-2 text-sm text-ok">
          Password aggiornata.
        </p>
        <Link href="/" className={primaryButtonClass}>
          Vai al catalogo
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <h2 className="text-center text-lg font-semibold">Scegli una nuova password</h2>
      <label className={fieldClass}>
        Nuova password
        <input name="password" type="password" required minLength={10} autoComplete="new-password" autoFocus className={inputClass} />
      </label>
      <label className={fieldClass}>
        Ripeti la password
        <input name="confirm" type="password" required minLength={10} autoComplete="new-password" className={inputClass} />
      </label>
      {status.kind === "error" && (
        <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
          {status.text}
        </p>
      )}
      <button type="submit" disabled={status.kind === "busy"} className={primaryButtonClass}>
        <KeyRound size={16} aria-hidden="true" />
        Salva
      </button>
      <Link href="/" className="text-center text-sm text-muted hover:underline">
        Annulla
      </Link>
    </form>
  );
}
