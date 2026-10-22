"use client";

import { Settings, X } from "lucide-react";
import { useEffect, useRef } from "react";
import { useT } from "../../i18n/i18n-context";
import { hasRole } from "../model";
import { settingsSections } from "../sections";
import { useSettings } from "../settings-context";

/** Pannello delle impostazioni: si apre dalla voce "Impostazioni" della barra laterale. */
export function SettingsDialog() {
  const { role, panelOpen: open, closePanel: onClose } = useSettings();
  const t = useT();
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
            {t.settings.title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t.common.close}
            className="flex size-9 items-center justify-center rounded-lg text-ink-soft hover:bg-chip"
          >
            <X size={18} />
          </button>
        </header>
        <div className="flex flex-1 flex-col gap-6 overflow-auto px-5 py-5">
          {sections.map(({ id, Icon, Body }) => {
            const { title, description } = t.settings.sections[id];
            return (
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
            );
          })}
        </div>
      </div>
    </dialog>
  );
}
