"use client";

import { useState } from "react";
import type { SignedInViewer } from "@/features/auth/viewer";
import { SettingsDialog } from "../../settings/components/settings-panel";
import { SettingsProvider, useSettings } from "../../settings/settings-context";
import type { Library } from "../model";
import { AddBookDialog } from "./add-book-dialog";
import { DesktopShell } from "./desktop";
import { ImportDialog } from "./import-dialog";
import { LibraryProvider, useLibrary } from "./library-context";
import { LoanDialog } from "./loan-dialog";
import { MobileShell } from "./mobile";

function Screens() {
  const { selected, canEdit } = useLibrary();
  const { preferences } = useSettings();
  const [lending, setLending] = useState(false);
  const lend = () => setLending(true);
  return (
    <div data-palette={preferences.palette} className="flex min-h-dvh flex-1 flex-col bg-bg text-ink">
      <div className="hidden h-dvh flex-col md:flex">
        <DesktopShell onLend={lend} />
      </div>
      <div className="md:hidden">
        <MobileShell onLend={lend} />
      </div>
      {canEdit && (
        <>
          <LoanDialog book={lending ? selected : null} onClose={() => setLending(false)} />
          <ImportDialog />
          <AddBookDialog />
        </>
      )}
      <SettingsDialog />
    </div>
  );
}

export function LibraryApp({ library, viewer }: { library: Library; viewer: SignedInViewer }) {
  return (
    <SettingsProvider role={viewer.role} userId={viewer.userId}>
      <LibraryProvider library={library} viewer={viewer}>
        <Screens />
      </LibraryProvider>
    </SettingsProvider>
  );
}
