import Image from "next/image";
import type { Messages } from "../../i18n/messages";
import { useT } from "../../i18n/i18n-context";
import type { Book } from "../model";
import type { LoanState } from "../query";

// Colori delle copertine generate quando manca l'immagine.
const coverColors = [
  "#1f4e5f",
  "#7a3b2e",
  "#4b5a2a",
  "#8a6a1f",
  "#3e4a7a",
  "#6b2d4f",
  "#2c2c2c",
  "#5a4636",
  "#2f6b4f",
  "#7a5a8a",
  "#9a3b3b",
  "#2e5f8a",
] as const;

// FNV-1a: sparge bene anche id simili tra loro.
const hash = (value: string) =>
  [...value].reduce((total, char) => Math.imul(total ^ char.charCodeAt(0), 16777619) >>> 0, 2166136261);

export const coverColor = (book: Pick<Book, "id">) => coverColors[hash(book.id) % coverColors.length];

export const loanBanner = (state: LoanState, t: Messages) => {
  switch (state.kind) {
    case "due":
      return {
        tone: "ok" as const,
        text: state.daysLeft === 0 ? t.loans.dueToday : t.loans.dueInShort(state.daysLeft),
      };
    case "overdue":
      return { tone: "danger" as const, text: t.loans.lateShort(state.daysLate) };
    case "open":
      return { tone: "ok" as const, text: t.loans.lentTo(state.borrower) };
    case "none":
      return null;
  }
};

type CoverProps = {
  readonly book: Book;
  readonly loan?: LoanState;
  readonly size?: "xs" | "sm" | "md" | "lg";
  readonly className?: string;
};

const textSize = {
  xs: { title: "hidden", author: "hidden", pad: "p-1" },
  sm: { title: "text-[11px]", author: "text-[8px]", pad: "p-2" },
  md: { title: "text-[15px]", author: "text-[9px]", pad: "p-3" },
  lg: { title: "text-xl", author: "text-[10px]", pad: "p-4" },
} as const;

export function Cover({ book, loan, size = "md", className = "" }: CoverProps) {
  const t = useT();
  const banner = loan ? loanBanner(loan, t) : null;
  const text = textSize[size];
  return (
    <div
      className={`relative aspect-[2/3] overflow-hidden rounded-[3px_6px_6px_3px] text-[#f6f1e7] shadow-[0_8px_18px_var(--cover-shadow)] ${className}`}
      style={{ background: coverColor(book) }}
    >
      {book.coverUrl ? (
        <Image src={book.coverUrl} alt="" fill unoptimized className="object-cover" />
      ) : (
        <div className={`flex h-full flex-col justify-between ${text.pad}`} aria-hidden="true">
          <div className={`font-cover leading-tight ${text.title}`}>{book.title}</div>
          <div className={`uppercase tracking-[0.08em] opacity-85 ${text.author}`}>
            {book.authors[0]}
          </div>
        </div>
      )}
      {banner && size !== "xs" && (
        <div
          className={`absolute inset-x-0 bottom-0 px-2 py-1 text-[11px] font-semibold text-white ${
            banner.tone === "danger" ? "bg-[#b42318]" : "bg-[#1d7a45]"
          }`}
        >
          {banner.text}
        </div>
      )}
    </div>
  );
}
