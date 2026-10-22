import type { ReactNode } from "react";
import { branding } from "@/config/branding";
import { Logo } from "@/features/library/components/logo";

// Cornice comune alle pagine di accesso.
export function AuthCard({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-1 items-center justify-center bg-panel px-4 py-10 text-ink">
      <div className="flex w-full max-w-sm flex-col gap-6 rounded-2xl border border-line bg-bg p-6 shadow-sm sm:p-8">
        <div className="flex flex-col items-center gap-2 text-center">
          <Logo size={64} />
          <h1 className="text-xl font-semibold">{branding.name}</h1>
        </div>
        {children}
      </div>
    </main>
  );
}

export const fieldClass = "flex flex-col gap-1 text-sm";
export const inputClass =
  "h-10 rounded-lg border border-line-strong bg-surface px-3 text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent";
export const primaryButtonClass =
  "flex h-10 items-center justify-center gap-2 rounded-lg bg-accent px-4 font-medium text-accent-ink disabled:opacity-60";
