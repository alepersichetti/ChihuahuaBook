import { LibraryApp } from "@/features/library/components/library-app";
import { sampleLibrary } from "@/features/library/sample-library";

// Per ora la UI gira sui dati di esempio; il collegamento a Supabase arriva con il backend.
export default function Home() {
  return <LibraryApp library={sampleLibrary} />;
}
