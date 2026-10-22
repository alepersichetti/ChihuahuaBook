"use client";

import { KeyRound, LogIn, MailCheck, UserPlus } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { safeNextPath } from "@/server/platform/next/access";
import { useT } from "@/features/i18n/i18n-context";
import { authErrorKey } from "../messages";
import { fieldClass, inputClass, primaryButtonClass } from "./auth-card";

type Mode = "signin" | "signup" | "reset";
type SignupMode = "first_admin" | "open" | "invite_only";
type Status = { readonly kind: "idle" | "busy" } | { readonly kind: "error" | "info"; readonly text: string };

export function LoginForm() {
  const router = useRouter();
  const t = useT();
  const params = useSearchParams();
  const next = safeNextPath(params.get("next"));
  const [mode, setMode] = useState<Mode>("signin");
  const [signupMode, setSignupMode] = useState<SignupMode | null>(null);
  const [status, setStatus] = useState<Status>(
    params.get("error") ? { kind: "error", text: t.auth.invalidLink } : { kind: "idle" },
  );

  useEffect(() => {
    createClient().map((supabase) =>
      supabase.rpc("signup_mode").then(({ data }) => {
        if (data) setSignupMode(data);
        if (data === "first_admin") setMode("signup");
      }),
    );
  }, []);

  const confirmUrl = (after: string) =>
    `${window.location.origin}/auth/confirm?next=${encodeURIComponent(after)}`;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const email = String(data.get("email") ?? "").trim();
    const password = String(data.get("password") ?? "");
    const client = createClient();
    if (client.isErr()) return setStatus({ kind: "error", text: t.auth.errors.generic });
    const supabase = client.value;
    setStatus({ kind: "busy" });

    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return setStatus({ kind: "error", text: t.auth.errors[authErrorKey(error, "signin")] });
      router.replace(next);
      router.refresh();
      return;
    }

    if (mode === "signup") {
      if (password !== String(data.get("confirm") ?? ""))
        return setStatus({ kind: "error", text: t.auth.passwordsDiffer });
      const { data: result, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: confirmUrl(next),
          data: { display_name: String(data.get("name") ?? "").trim() },
        },
      });
      if (error) return setStatus({ kind: "error", text: t.auth.errors[authErrorKey(error, "signup")] });
      if (result.session) {
        router.replace(next);
        router.refresh();
        return;
      }
      return setStatus({ kind: "info", text: t.auth.confirmSent });
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: confirmUrl("/account/password"),
    });
    // Stessa risposta che l'email esista o no.
    setStatus(
      error && error.status === 429
        ? { kind: "error", text: t.auth.errors[authErrorKey(error, "reset")] }
        : { kind: "info", text: t.auth.resetSent },
    );
  };

  const switchTo = (target: Mode) => {
    setMode(target);
    setStatus({ kind: "idle" });
  };

  const busy = status.kind === "busy";
  const SubmitIcon = mode === "signin" ? LogIn : mode === "signup" ? UserPlus : MailCheck;

  return (
    <div className="flex flex-col gap-5">
      <h2 className="text-center text-lg font-semibold">{t.auth.titles[mode]}</h2>
      {mode === "signup" && signupMode && <p className="text-center text-sm text-muted">{t.auth.signupHints[signupMode]}</p>}

      <form onSubmit={submit} className="flex flex-col gap-4">
        {mode === "signup" && (
          <label className={fieldClass}>
            {t.auth.name}
            <input name="name" autoComplete="name" maxLength={100} className={inputClass} />
          </label>
        )}
        <label className={fieldClass}>
          {t.auth.email}
          <input name="email" type="email" required autoComplete="email" autoFocus className={inputClass} />
        </label>
        {mode !== "reset" && (
          <label className={fieldClass}>
            {t.auth.password}
            <input
              name="password"
              type="password"
              required
              minLength={mode === "signup" ? 10 : undefined}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              className={inputClass}
            />
          </label>
        )}
        {mode === "signup" && (
          <label className={fieldClass}>
            {t.auth.repeatPassword}
            <input name="confirm" type="password" required minLength={10} autoComplete="new-password" className={inputClass} />
          </label>
        )}

        {(status.kind === "error" || status.kind === "info") && (
          <p
            role={status.kind === "error" ? "alert" : "status"}
            className={`rounded-lg px-3 py-2 text-sm ${status.kind === "error" ? "bg-danger-soft text-danger" : "bg-ok-soft text-ok"}`}
          >
            {status.text}
          </p>
        )}

        <button type="submit" disabled={busy} className={primaryButtonClass}>
          <SubmitIcon size={16} aria-hidden="true" />
          {busy ? t.common.wait : t.auth.submit[mode]}
        </button>
      </form>

      <div className="flex flex-col items-center gap-1.5 text-sm">
        {mode !== "signin" && (
          <button type="button" onClick={() => switchTo("signin")} className="text-accent hover:underline">
            {t.auth.haveAccount}
          </button>
        )}
        {mode !== "signup" && (
          <button type="button" onClick={() => switchTo("signup")} className="flex items-center gap-1.5 text-accent hover:underline">
            <UserPlus size={14} aria-hidden="true" />
            {t.auth.titles.signup}
          </button>
        )}
        {mode !== "reset" && (
          <button type="button" onClick={() => switchTo("reset")} className="flex items-center gap-1.5 text-muted hover:underline">
            <KeyRound size={14} aria-hidden="true" />
            {t.auth.forgot}
          </button>
        )}
      </div>
    </div>
  );
}
