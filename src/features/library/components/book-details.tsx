"use client";

import {
  ChevronLeft,
  ChevronRight,
  Ellipsis,
  HandHelping,
  Heart,
  Pencil,
  Undo2,
  X,
} from "lucide-react";
import type { ReactNode } from "react";
import { readStatusLabel } from "../labels";
import { readStatuses, type Book, type ReadStatus, type ValueFilter } from "../model";
import { loanState } from "../query";
import { Cover } from "./cover";
import { readStatusIcon } from "./icons";
import { useLibrary } from "./library-context";
import { Rating, RatingInput } from "./rating";

const formatDate = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" });

// Un valore cliccabile filtra la collezione, come i valori in corsivo di Bookpedia.
function FilterValue({ field, value }: ValueFilter) {
  const { dispatch } = useLibrary();
  return (
    <button
      type="button"
      onClick={() => dispatch({ type: "setValueFilter", filter: { field, value } })}
      className="text-left text-accent underline-offset-2 hover:underline"
      title={`Mostra solo i libri con questo valore`}
    >
      {value}
    </button>
  );
}

const joinNodes = (nodes: readonly ReactNode[]) =>
  nodes.flatMap((node, index) => (index === 0 ? [node] : [<span key={`sep-${index}`}>, </span>, node]));

const facts = (book: Book): readonly { label: string; value: ReactNode }[] =>
  [
    { label: "Editore", value: book.publisher && <FilterValue field="publisher" value={book.publisher} /> },
    {
      label: "Anno",
      value: book.publishedYear !== null && <FilterValue field="publishedYear" value={String(book.publishedYear)} />,
    },
    {
      label: "Genere",
      value:
        book.genres.length > 0 &&
        joinNodes(book.genres.map((genre) => <FilterValue key={genre} field="genres" value={genre} />)),
    },
    {
      label: "Serie",
      value: book.series && (
        <span>
          <FilterValue field="series" value={book.series} />
          {book.seriesNumber !== null && ` · n. ${book.seriesNumber}`}
        </span>
      ),
    },
    { label: "Pagine", value: book.pages },
    { label: "Lingua", value: book.language },
    { label: "Posizione", value: book.location },
    {
      label: "Tag",
      value:
        book.tags.length > 0 &&
        joinNodes(book.tags.map((tag) => <FilterValue key={tag} field="tags" value={tag} />)),
    },
    { label: "ISBN", value: book.isbn13 },
  ].filter((fact) => fact.value !== null && fact.value !== false && fact.value !== undefined);

function LoanBox({ book, onLend }: { book: Book; onLend: () => void }) {
  const { today, dispatch, canEdit } = useLibrary();
  const loan = loanState(book, today);
  if (loan.kind === "none" || !book.loan) {
    if (!canEdit) return null;
    return (
      <button
        type="button"
        onClick={onLend}
        className="flex h-10 items-center justify-center gap-2 rounded-lg border border-line-strong bg-surface font-medium"
      >
        <HandHelping size={16} aria-hidden="true" />
        Presta
      </button>
    );
  }
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-3.5 text-sm">
      <div className="flex items-center gap-2 font-semibold">
        <HandHelping size={16} className="text-tone-loan" aria-hidden="true" />
        Prestato a {book.loan.borrower}
      </div>
      <div className="text-muted">
        Dal {formatDate(book.loan.loanedOn)}
        {book.loan.dueOn && `, scadenza ${formatDate(book.loan.dueOn)}`}
      </div>
      {loan.kind === "overdue" && (
        <div className="self-start rounded-full bg-danger-soft px-2 py-0.5 text-xs font-semibold text-danger">
          In ritardo di {loan.daysLate} giorni
        </div>
      )}
      {loan.kind === "due" && (
        <div className="self-start rounded-full bg-ok-soft px-2 py-0.5 text-xs font-semibold text-ok">
          {loan.daysLeft === 0 ? "Rientra oggi" : `Rientra tra ${loan.daysLeft} giorni`}
        </div>
      )}
      {canEdit && (
        <button
          type="button"
          onClick={() => dispatch({ type: "returnBook", bookId: book.id })}
          className="flex h-9 items-center justify-center gap-2 rounded-lg bg-accent font-semibold text-accent-ink"
        >
          <Undo2 size={16} aria-hidden="true" />
          Restituito
        </button>
      )}
    </div>
  );
}

function ReadStatusSelect({ book }: { book: Book }) {
  const { dispatch, canEdit } = useLibrary();
  const Icon = readStatusIcon[book.readStatus];
  if (!canEdit) {
    return (
      <span className="flex items-center gap-1.5 self-start rounded-full bg-chip px-2.5 py-1 text-xs font-semibold">
        <Icon size={13} aria-hidden="true" />
        {readStatusLabel[book.readStatus]}
      </span>
    );
  }
  return (
    <label className="flex items-center gap-1.5 self-start rounded-full bg-chip py-1 pr-1 pl-2.5 text-xs font-semibold">
      <Icon size={13} aria-hidden="true" />
      <span className="sr-only">Stato di lettura</span>
      <select
        value={book.readStatus}
        onChange={(event) =>
          dispatch({ type: "setReadStatus", bookId: book.id, status: event.target.value as ReadStatus })
        }
        className="bg-transparent outline-none"
      >
        {readStatuses.map((status) => (
          <option key={status} value={status}>
            {readStatusLabel[status]}
          </option>
        ))}
      </select>
    </label>
  );
}

function Pager({ onClose }: { onClose?: () => void }) {
  const { books, selected, dispatch } = useLibrary();
  const index = books.findIndex((book) => book.id === selected?.id);
  const go = (step: number) => {
    const next = books[index + step];
    if (next) dispatch({ type: "selectBook", bookId: next.id });
  };
  const button = "flex size-8 items-center justify-center rounded-lg border border-line-strong bg-surface disabled:opacity-40";
  return (
    <div className="flex items-center justify-between text-[13px] text-muted">
      <span>{index >= 0 ? `${index + 1} di ${books.length}` : "Fuori dalla ricerca"}</span>
      <div className="flex gap-1">
        <button type="button" aria-label="Libro precedente" disabled={index <= 0} onClick={() => go(-1)} className={button}>
          <ChevronLeft size={16} />
        </button>
        <button type="button" aria-label="Libro successivo" disabled={index < 0 || index >= books.length - 1} onClick={() => go(1)} className={button}>
          <ChevronRight size={16} />
        </button>
        {onClose && (
          <button type="button" aria-label="Chiudi dettagli" onClick={onClose} className={button}>
            <X size={16} />
          </button>
        )}
      </div>
    </div>
  );
}

export function BookDetails({
  book,
  variant,
  onLend,
  onClose,
}: {
  book: Book;
  variant: "side" | "drawer" | "below" | "page";
  onLend: () => void;
  onClose?: () => void;
}) {
  const { dispatch, canEdit } = useLibrary();
  const list = facts(book);
  const header = (
    <div className={`flex gap-4 ${variant === "drawer" ? "flex-col items-center text-center" : ""}`}>
      <Cover
        book={book}
        size={variant === "drawer" ? "lg" : "md"}
        className={variant === "drawer" ? "w-[150px]" : variant === "below" ? "hidden" : "w-[104px] shrink-0"}
      />
      <div className={`flex min-w-0 flex-col gap-1.5 ${variant === "drawer" ? "items-center" : ""}`}>
        <h2 className={`font-display leading-tight font-semibold ${variant === "side" ? "text-lg" : "text-2xl"}`}>
          {book.title}
        </h2>
        {book.subtitle && <p className="text-sm text-muted">{book.subtitle}</p>}
        <div className="font-medium">
          {joinNodes(book.authors.map((author) => <FilterValue key={author} field="authors" value={author} />))}
        </div>
        {canEdit ? (
          <RatingInput rating={book.rating} onChange={(rating) => dispatch({ type: "setRating", bookId: book.id, rating })} />
        ) : (
          <Rating rating={book.rating} />
        )}
        <ReadStatusSelect book={book} />
      </div>
    </div>
  );
  const body = (
    <>
      {list.length > 0 && (
        <dl className="grid grid-cols-[96px_minmax(0,1fr)] gap-y-2 text-[13px]">
          {list.map((fact) => (
            <div key={fact.label} className="contents">
              <dt className="text-muted">{fact.label}</dt>
              <dd>{fact.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {book.summary && (
        <section>
          <h3 className="mb-1.5 text-xs font-semibold tracking-wide text-muted uppercase">Trama</h3>
          <p className="text-[13px] leading-relaxed text-ink-soft">{book.summary}</p>
        </section>
      )}
      {book.notes && (
        <section>
          <h3 className="mb-1.5 text-xs font-semibold tracking-wide text-muted uppercase">Note</h3>
          <p className="text-[13px] leading-relaxed text-ink-soft">{book.notes}</p>
        </section>
      )}
    </>
  );
  const actions = (
    <div className="flex flex-col gap-2">
      <LoanBox book={book} onLend={onLend} />
      {canEdit && (
      <div className="flex gap-2">
        <button
          type="button"
          disabled
          title="In arrivo"
          className="flex h-10 flex-1 items-center justify-center gap-2 rounded-lg border border-line-strong bg-surface font-medium disabled:opacity-60"
        >
          <Pencil size={16} aria-hidden="true" />
          Modifica
        </button>
        <button
          type="button"
          aria-label={book.favorite ? "Togli dai preferiti" : "Aggiungi ai preferiti"}
          aria-pressed={book.favorite}
          onClick={() => dispatch({ type: "toggleFavorite", bookId: book.id })}
          className="flex size-10 items-center justify-center rounded-lg border border-line-strong bg-surface"
        >
          <Heart size={16} className={book.favorite ? "fill-current text-tone-loan" : ""} />
        </button>
        <button
          type="button"
          aria-label="Altre azioni"
          title="In arrivo"
          disabled
          className="flex size-10 items-center justify-center rounded-lg border border-line-strong bg-surface disabled:opacity-60"
        >
          <Ellipsis size={16} />
        </button>
      </div>
      )}
    </div>
  );

  if (variant === "below") {
    return (
      <section aria-label="Dettagli del libro" className="flex flex-wrap gap-7 overflow-auto px-6 py-5">
        <div className="flex min-w-0 flex-[2_1_360px] flex-col gap-4">
          {header}
          {body}
        </div>
        <div className="flex flex-[1_1_240px] flex-col gap-3">{actions}</div>
      </section>
    );
  }

  return (
    <aside
      aria-label="Dettagli del libro"
      className={`flex flex-col gap-4 overflow-y-auto px-5 py-4 ${
        variant === "side"
          ? "w-[340px] shrink-0 border-l border-line"
          : variant === "drawer"
            ? "w-[380px] shrink-0 border-l border-line bg-surface shadow-[-12px_0_32px_rgba(60,40,20,0.10)]"
            : ""
      }`}
    >
      {variant !== "page" && <Pager onClose={onClose} />}
      {header}
      {body}
      <div className="mt-auto">{actions}</div>
    </aside>
  );
}
