"use client";

import { Settings, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { hasRole } from "../model";
import { settingsSections } from "../sections";
import { useSettings } from "../settings-context";

function SettingsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { role } = useSettings();
  const dialog = useRef<HTMLDialogElement>(null);
  const sections = settingsSections.filter((section) => hasRole(role, section.minRole));

  useEffect(() => {
    if (open) dialog.current?.showModal();
    else dialog.current?.close();
  }, [open]);

  return (
    <dialog
      ref={dialog}
      onClose={onClose}
      onClick={(event) => event.target === dialog.current && onClose()}
      aria-labelledby="settings-title"
      className="m-0 ml-auto h-dvh max-h-none w-full max-w-none border-l border-line bg-bg p-0 text-ink shadow-2xl backdrop:bg-black/40 md:w-[420px]"
    >
      <div className="flex h-full flex-col">
        <header className="flex items-center gap-2 border-b border-line px-5 py-4">
          <Settings size={20} className="text-muted" aria-hidden="true" />
          <h2 id="settings-title" className="flex-1 font-display text-xl font-bold">
            Impostazioni
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Chiudi"
            className="flex size-9 items-center justify-center rounded-lg text-ink-soft hover:bg-chip"
          >
            <X size={18} />
          </button>
        </header>
        <div className="flex flex-1 flex-col gap-6 overflow-auto px-5 py-5">
          {sections.map(({ id, title, description, Icon, Body }) => (
            <section key={id} aria-labelledby={`settings-${id}`} className="flex flex-col gap-3">
              <div>
                <h3 id={`settings-${id}`} className="flex items-center gap-2 text-xs font-bold tracking-wider text-muted uppercase">
                  <Icon size={14} aria-hidden="true" />
                  {title}
                </h3>
                {description && <p className="mt-1 text-xs text-muted">{description}</p>}
              </div>
              <Body />
            </section>
          ))}
        </div>
      </div>
    </dialog>
  );
}

/** Ingranaggio in basso a destra; i lettori non lo vedono. */
export function SettingsButton() {
  const { canOpen } = useSettings();
  const [open, setOpen] = useState(false);
  if (!canOpen) return null;
  return (
    <>
      <button
        type="button"
        aria-label="Impostazioni"
        title="Impostazioni"
        onClick={() => setOpen(true)}
        className="fixed right-5 bottom-[172px] z-10 flex size-11 items-center justify-center rounded-full border border-line-strong bg-surface text-ink-soft shadow-lg hover:text-ink md:right-5 md:bottom-12"
      >
        <Settings size={20} />
      </button>
      <SettingsDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}
