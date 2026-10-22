import { redirect } from "next/navigation";
import { Suspense } from "react";
import { InactiveAccount } from "@/features/auth/components/inactive-account";
import { LibraryApp } from "@/features/library/components/library-app";
import { sampleLibrary } from "@/features/library/sample-library";
import { getViewer } from "@/lib/auth/viewer";

// Per ora la UI gira sui dati di esempio; il collegamento a Supabase arriva con il backend.
async function Library() {
  const viewer = await getViewer();
  if (viewer.status === "anonymous") redirect("/login");
  if (viewer.status === "inactive") return <InactiveAccount email={viewer.email} />;
  const { userId, email, role } = viewer;
  return <LibraryApp library={sampleLibrary} viewer={{ userId, email, role }} />;
}

export default function Home() {
  return (
    <Suspense fallback={<div className="min-h-dvh flex-1 bg-bg" aria-busy="true" />}>
      <Library />
    </Suspense>
  );
}
