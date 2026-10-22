import {
  Archive,
  BookCheck,
  BookCopy,
  BookMarked,
  BookX,
  Folder,
  HandHelping,
  Library,
  type LucideIcon,
  Sparkles,
  Star,
  BookOpen,
} from "lucide-react";
import type { Collection, ReadStatus } from "../model";

// Icona e colore di ogni tipo di collezione, ripresi dai colori di Bookpedia.
export const collectionIcon = (collection: Collection): { Icon: LucideIcon; tone: string } => {
  switch (collection.kind) {
    case "library":
      return { Icon: Library, tone: "text-accent" };
    case "loaned":
      return { Icon: HandHelping, tone: "text-tone-loan" };
    case "wishlist":
      return { Icon: Star, tone: "text-star" };
    case "regular":
      return collection.excluded
        ? { Icon: Archive, tone: "text-muted" }
        : { Icon: BookCopy, tone: "text-tone-collection" };
    case "smart":
      return { Icon: Sparkles, tone: "text-tone-smart" };
    case "folder":
      return { Icon: Folder, tone: "text-muted" };
  }
};

export const readStatusIcon: Record<ReadStatus, LucideIcon> = {
  unread: BookOpen,
  reading: BookMarked,
  read: BookCheck,
  abandoned: BookX,
};
