import { redirect } from "next/navigation";
import { Suspense } from "react";
import { InactiveAccount } from "@/features/auth/components/inactive-account";
import { I18nProvider } from "@/features/i18n/i18n-context";
import { LibraryApp } from "@/features/library/components/library-app";
import { getViewer } from "@/lib/auth/viewer";
import { getLanguage } from "@/lib/i18n";
import { loadLibrary } from "@/lib/library/load";

// La biblioteca arriva dal database già nella pagina: niente attesa dopo il primo disegno.
async function Library() {
  const [viewer, language] = await Promise.all([getViewer(), getLanguage()]);
  if (viewer.status === "anonymous") redirect("/login");
  const { userId, email, role } = viewer.status === "member" ? viewer : { userId: "", email: viewer.email, role: null };
  const library = role === null ? null : await loadLibrary();
  return (
    <I18nProvider language={language}>
      {role === null || library === null ? (
        <InactiveAccount email={email} />
      ) : (
        <LibraryApp library={library} viewer={{ userId, email, role }} />
      )}
    </I18nProvider>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<div className="min-h-dvh flex-1 bg-bg" aria-busy="true" />}>
      <Library />
    </Suspense>
  );
}
