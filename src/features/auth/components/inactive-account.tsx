"use client";

import { LogOut } from "lucide-react";
import { useT } from "@/features/i18n/i18n-context";
import { AuthCard, primaryButtonClass } from "./auth-card";

// Account registrato ma disattivato dall'amministratore (o non più membro).
export function InactiveAccount({ email }: { email: string }) {
  const t = useT();
  return (
    <AuthCard>
      <div className="flex flex-col gap-4 text-center">
        <h2 className="text-lg font-semibold">{t.auth.inactiveTitle}</h2>
        <p className="text-sm text-muted">{t.auth.inactiveText(email)}</p>
        <form action="/auth/signout" method="post">
          <button type="submit" className={`${primaryButtonClass} w-full`}>
            <LogOut size={16} aria-hidden="true" />
            {t.account.signOut}
          </button>
        </form>
      </div>
    </AuthCard>
  );
}
