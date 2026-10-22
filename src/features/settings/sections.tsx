"use client";

import { Info, Languages, Palette, Users, type LucideIcon } from "lucide-react";
import { useState } from "react";
import { adminApi } from "../admin/api";
import { UsersAndAccess } from "../admin/components/users-and-access";
import type { ComponentType } from "react";
import { branding } from "@/config/branding";
import { Logo } from "../library/components/logo";
import { useI18n, useT } from "../i18n/i18n-context";
import { languageNames, languages, type Language } from "../i18n/languages";
import type { Messages } from "../i18n/messages";
import { layouts, type Layout } from "../library/model";
import { coverSizes } from "../library/state";
import pkg from "../../../package.json";
import type { Role } from "./model";
import { useSettings } from "./settings-context";

/**
 * Una sezione del pannello. Per aggiungerne una basta metterla in `settingsSections`:
 * `minRole` dice chi la vede (il lettore non apre proprio il pannello).
 */
export type SettingsSection = {
  /** Titolo e descrizione stanno nei testi tradotti, sotto `settings.sections.<id>`. */
  readonly id: keyof Messages["settings"]["sections"];
  readonly Icon: LucideIcon;
  readonly minRole: Exclude<Role, "reader">;
  readonly Body: ComponentType;
};

// Ogni anteprima usa i colori veri del suo layout, presi da globals.css tramite data-layout.
function LayoutSwatch({ layout }: { layout: Layout }) {
  return (
    <span data-layout={layout} aria-hidden="true" className="flex h-12 w-16 shrink-0 overflow-hidden rounded-md border border-line bg-bg">
      <span className="w-3.5 bg-panel" />
      <span className="flex flex-1 flex-col gap-1 p-1.5">
        <span className="h-1.5 w-8 rounded-full bg-accent" />
        <span className="h-1 w-full rounded-full bg-line-strong" />
        <span className="h-1 w-3/4 rounded-full bg-line-strong" />
      </span>
    </span>
  );
}

function Appearance() {
  const { preferences, setPreference } = useSettings();
  const t = useT();
  return (
    <div className="flex flex-col gap-4">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-semibold">{t.settings.layout}</legend>
        {layouts.map((layout) => (
          <label
            key={layout}
            className={`flex cursor-pointer items-center gap-3 rounded-xl border p-2.5 ${
              preferences.layout === layout ? "border-accent bg-selected" : "border-line hover:bg-chip"
            }`}
          >
            <input
              type="radio"
              name="layout"
              value={layout}
              checked={preferences.layout === layout}
              onChange={() => setPreference("layout", layout)}
              className="sr-only"
            />
            <LayoutSwatch layout={layout} />
            <span className="flex flex-col">
              <span className="text-sm font-semibold">{t.layouts[layout]}</span>
              <span className="text-xs text-muted">{t.settings.layoutHints[layout]}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <label className="flex flex-col gap-2 text-sm">
        <span className="flex justify-between font-semibold">
          {t.settings.coverSize}
          <span className="font-normal text-muted">{preferences.coverSize} px</span>
        </span>
        <input
          type="range"
          min={coverSizes.min}
          max={coverSizes.max}
          value={preferences.coverSize}
          onChange={(event) => setPreference("coverSize", Number(event.target.value))}
          className="accent-(--accent)"
        />
        <span className="text-xs text-muted">{t.settings.coverSizeHint}</span>
      </label>
    </div>
  );
}

// La lingua vale per tutti gli utenti dell'istanza: la salva il server, solo per l'admin.
function LanguageSection() {
  const { t, language, setLanguage } = useI18n();
  const [error, setError] = useState<string | null>(null);
  const choose = async (next: Language) => {
    const result = await adminApi.updateSettings({ language: next });
    if (result.isOk()) {
      setError(null);
      setLanguage(next);
    } else {
      setError(t.admin.errors[result.error]);
    }
  };
  return (
    <div className="flex flex-col gap-2">
      <div role="radiogroup" aria-label={t.settings.sections.language.title} className="flex gap-2">
        {languages.map((option) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={language === option}
            lang={option}
            onClick={() => void choose(option)}
            className={`flex-1 rounded-xl border px-3 py-2 text-sm font-semibold ${
              language === option ? "border-accent bg-selected" : "border-line hover:bg-chip"
            }`}
          >
            {languageNames[option]}
          </button>
        ))}
      </div>
      {error && (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

// Ruoli, inviti e registrazione: il componente parla con /api/admin.
function UsersSection() {
  const { userId } = useSettings();
  return <UsersAndAccess currentUserId={userId} />;
}

function About() {
  const t = useT();
  return (
    <div className="flex items-center gap-3">
      <Logo size={48} />
      <div className="flex flex-col text-sm">
        <span className="font-semibold">{branding.name}</span>
        <span className="text-muted">{t.settings.version(pkg.version)}</span>
        <a
          href="https://github.com/alepersichetti/ChihuahuaBook"
          target="_blank"
          rel="noreferrer"
          className="text-accent hover:underline"
        >
          {t.settings.sourceCode}
        </a>
      </div>
    </div>
  );
}

export const settingsSections: readonly SettingsSection[] = [
  {
    id: "appearance",
    Icon: Palette,
    minRole: "librarian",
    Body: Appearance,
  },
  {
    id: "language",
    Icon: Languages,
    minRole: "admin",
    Body: LanguageSection,
  },
  {
    id: "users",
    Icon: Users,
    minRole: "admin",
    Body: UsersSection,
  },
  {
    id: "about",
    Icon: Info,
    minRole: "librarian",
    Body: About,
  },
];
