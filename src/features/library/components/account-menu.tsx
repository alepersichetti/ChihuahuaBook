"use client";

import { KeyRound, LogOut, UserRound } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useT } from "@/features/i18n/i18n-context";
import { useLibrary } from "./library-context";

const item = "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm hover:bg-chip";

// Chi è collegato, con quale ruolo, e le azioni sull'account.
export function AccountMenu() {
  const { viewer } = useLibrary();
  const t = useT();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent ? event.key === "Escape" : !root.current?.contains(event.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-label={t.account.label}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((value) => !value)}
        className="flex size-9 items-center justify-center rounded-full border border-line-strong bg-surface text-ink-soft hover:bg-chip"
      >
        <UserRound size={18} />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute top-11 right-0 z-30 flex w-64 flex-col gap-1 rounded-xl border border-line bg-bg p-2 text-ink shadow-xl"
        >
          <div className="px-3 py-2">
            <div className="truncate text-sm font-medium" title={viewer.email}>
              {viewer.email}
            </div>
            <div className="text-xs text-muted">{t.roles[viewer.role]}</div>
          </div>
          <div className="border-t border-line" />
          <Link role="menuitem" href="/account/password" className={item}>
            <KeyRound size={16} aria-hidden="true" />
            {t.account.changePassword}
          </Link>
          <form action="/auth/signout" method="post">
            <button role="menuitem" type="submit" className={`${item} text-danger`}>
              <LogOut size={16} aria-hidden="true" />
              {t.account.signOut}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
