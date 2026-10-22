"use client";

import { useState } from "react";
import { SettingsDialog } from "../../settings/components/settings-panel";
import type { Role } from "../../settings/model";
import { SettingsProvider } from "../../settings/settings-context";
import type { Library } from "../model";
import { DesktopShell } from "./desktop";
import { ImportDialog } from "./import-dialog";
import { LibraryProvider, useLibrary } from "./library-context";
import { LoanDialog } from "./loan-dialog";
import { MobileShell } from "./mobile";

function Screens() {
  const { state, selected } = useLibrary();
  const [lending, setLending] = useState(false);
  const lend = () => setLending(true);
  return (
    <div data-layout={state.layout} className="flex min-h-dvh flex-1 flex-col bg-bg text-ink">
      <div className="hidden h-dvh flex-col md:flex">
        <DesktopShell onLend={lend} />
      </div>
      <div className="md:hidden">
        <MobileShell onLend={lend} />
      </div>
      <LoanDialog book={lending ? selected : null} onClose={() => setLending(false)} />
      <ImportDialog />
      <SettingsDialog />
    </div>
  );
}

export function LibraryApp({ library, role }: { library: Library; role?: Role }) {
  return (
    <SettingsProvider role={role}>
      <LibraryProvider library={library}>
        <Screens />
      </LibraryProvider>
    </SettingsProvider>
  );
}
