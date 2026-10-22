"use client";

import { BookOpen, Info, Palette, ShieldCheck, Users, type LucideIcon } from "lucide-react";
import type { ComponentType } from "react";
import { branding } from "@/config/branding";
import { Logo } from "../library/components/logo";
import { layoutLabel } from "../library/labels";
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
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly Icon: LucideIcon;
  readonly minRole: Exclude<Role, "reader">;
  readonly Body: ComponentType;
};

const layoutHint: Record<Layout, string> = {
  classic: "Tre colonne: collezioni, elenco e scheda del libro",
  gallery: "Come la classica, con le copertine in griglia",
  warm: "Come la galleria, con la palette calda",
  shelf: "Tema scuro con carosello e scheda sotto",
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
  return (
    <div className="flex flex-col gap-4">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-semibold">Layout</legend>
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
              <span className="text-sm font-semibold">{layoutLabel[layout]}</span>
              <span className="text-xs text-muted">{layoutHint[layout]}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <label className="flex flex-col gap-2 text-sm">
        <span className="flex justify-between font-semibold">
          Dimensione copertine
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
        <span className="text-xs text-muted">Nella vista a griglia.</span>
      </label>
    </div>
  );
}

const roleInfo: readonly { role: Role; label: string; Icon: LucideIcon; can: string }[] = [
  { role: "reader", label: "Lettore", Icon: BookOpen, can: "Consulta la libreria, senza impostazioni" },
  { role: "librarian", label: "Bibliotecario", Icon: Users, can: "Cura i libri e vede le impostazioni personali" },
  { role: "admin", label: "Amministratore", Icon: ShieldCheck, can: "Gestisce utenti, permessi e tutta l'app" },
];

function UsersAndAccess() {
  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col divide-y divide-line rounded-xl border border-line">
        {roleInfo.map(({ role, label, Icon, can }) => (
          <li key={role} className="flex items-center gap-3 px-3 py-2.5">
            <Icon size={18} className="shrink-0 text-muted" aria-hidden="true" />
            <span className="flex flex-col">
              <span className="text-sm font-semibold">{label}</span>
              <span className="text-xs text-muted">{can}</span>
            </span>
          </li>
        ))}
      </ul>
      <p className="rounded-lg bg-chip px-3 py-2 text-xs text-muted">
        Inviti e assegnazione dei ruoli arrivano insieme al login.
      </p>
    </div>
  );
}

function About() {
  return (
    <div className="flex items-center gap-3">
      <Logo size={48} />
      <div className="flex flex-col text-sm">
        <span className="font-semibold">{branding.name}</span>
        <span className="text-muted">Versione {pkg.version}</span>
        <a
          href="https://github.com/alepersichetti/ChihuahuaBook"
          target="_blank"
          rel="noreferrer"
          className="text-accent hover:underline"
        >
          Codice sorgente
        </a>
      </div>
    </div>
  );
}

export const settingsSections: readonly SettingsSection[] = [
  {
    id: "appearance",
    title: "Aspetto",
    description: "Le tue preferenze, salvate in questo browser.",
    Icon: Palette,
    minRole: "librarian",
    Body: Appearance,
  },
  {
    id: "users",
    title: "Utenti e accessi",
    description: "Chi può usare la libreria e cosa può fare.",
    Icon: Users,
    minRole: "admin",
    Body: UsersAndAccess,
  },
  {
    id: "about",
    title: "Informazioni",
    description: "",
    Icon: Info,
    minRole: "librarian",
    Body: About,
  },
];
