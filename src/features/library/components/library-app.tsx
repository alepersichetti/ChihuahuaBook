"use client";

import { useState } from "react";
import type { SignedInViewer } from "@/features/auth/viewer";
import type { Library } from "../model";
import { DesktopShell } from "./desktop";
import { ImportDialog } from "./import-dialog";
import { LibraryProvider, useLibrary } from "./library-context";
import { LoanDialog } from "./loan-dialog";
import { MobileShell } from "./mobile";

function Screens() {
  const { state, selected, canEdit } = useLibrary();
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
      {canEdit && (
        <>
          <LoanDialog book={lending ? selected : null} onClose={() => setLending(false)} />
          <ImportDialog />
        </>
      )}
    </div>
  );
}

export function LibraryApp({ library, viewer }: { library: Library; viewer: SignedInViewer }) {
  return (
    <LibraryProvider library={library} viewer={viewer}>
      <Screens />
    </LibraryProvider>
  );
}
