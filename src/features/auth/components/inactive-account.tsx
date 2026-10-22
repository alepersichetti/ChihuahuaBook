import { LogOut } from "lucide-react";
import { AuthCard, primaryButtonClass } from "./auth-card";

// Account registrato ma disattivato dall'amministratore (o non più membro).
export function InactiveAccount({ email }: { email: string }) {
  return (
    <AuthCard>
      <div className="flex flex-col gap-4 text-center">
        <h2 className="text-lg font-semibold">Account non attivo</h2>
        <p className="text-sm text-muted">
          {email ? <>L&apos;account {email} </> : "Questo account "}
          non ha accesso alla biblioteca. Chiedi all&apos;amministratore di riattivarlo.
        </p>
        <form action="/auth/signout" method="post">
          <button type="submit" className={`${primaryButtonClass} w-full`}>
            <LogOut size={16} aria-hidden="true" />
            Esci
          </button>
        </form>
      </div>
    </AuthCard>
  );
}
