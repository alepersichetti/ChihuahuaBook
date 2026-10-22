import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { UsersAndAccess } from "@/features/admin/components/users-and-access";
import { can } from "@/features/auth/viewer";
import { getViewer } from "@/lib/auth/viewer";

export const metadata: Metadata = { title: "Utenti e accessi" };

// La pagina controlla il ruolo sul server; le API e la RLS lo ricontrollano.
async function AdminContent() {
  const viewer = await getViewer();
  if (viewer.status === "anonymous") redirect("/login?next=/admin");
  if (viewer.status !== "member" || !can(viewer.role, "administer")) redirect("/");
  return <UsersAndAccess currentUserId={viewer.userId} />;
}

export default function AdminPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 bg-bg px-4 py-8 text-ink">
      <Link href="/" className="flex items-center gap-1.5 self-start text-sm text-accent hover:underline">
        <ArrowLeft size={16} aria-hidden="true" />
        Torna al catalogo
      </Link>
      <h1 className="text-2xl font-semibold">Utenti e accessi</h1>
      <Suspense fallback={<p className="text-sm text-muted">Caricamento…</p>}>
        <AdminContent />
      </Suspense>
    </main>
  );
}
