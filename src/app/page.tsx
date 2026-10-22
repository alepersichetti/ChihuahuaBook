import { redirect } from "next/navigation";
import { Suspense } from "react";
import { InactiveAccount } from "@/features/auth/components/inactive-account";
import { I18nProvider } from "@/features/i18n/i18n-context";
import { LibraryApp } from "@/features/library/components/library-app";
import { sampleLibrary } from "@/features/library/sample-library";
import { getViewer } from "@/lib/auth/viewer";
import { getLanguage } from "@/lib/i18n";

// Per ora la UI gira sui dati di esempio; il collegamento a Supabase arriva con il backend.
async function Library() {
  const [viewer, language] = await Promise.all([getViewer(), getLanguage()]);
  if (viewer.status === "anonymous") redirect("/login");
  const { userId, email, role } = viewer.status === "member" ? viewer : { userId: "", email: viewer.email, role: null };
  return (
    <I18nProvider language={language}>
      {role === null ? (
        <InactiveAccount email={email} />
      ) : (
        <LibraryApp library={sampleLibrary} viewer={{ userId, email, role }} />
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
