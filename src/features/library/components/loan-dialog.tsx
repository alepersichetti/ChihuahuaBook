"use client";

import { HandHelping } from "lucide-react";
import { useEffect, useRef, type FormEvent } from "react";
import type { Book } from "../model";
import { addDays } from "../query";
import { useLibrary } from "./library-context";

// Durata predefinita del prestito, come la preferenza "giorni di restituzione" di Bookpedia.
export const defaultLoanDays = 30;

export function LoanDialog({ book, onClose }: { book: Book | null; onClose: () => void }) {
  const { dispatch, today } = useLibrary();
  const dialog = useRef<HTMLDialogElement>(null);
  // Il form esiste solo dopo un clic, quindi qui siamo sempre nel browser.
  const start = book ? (today ?? new Date().toISOString().slice(0, 10)) : "";

  useEffect(() => {
    if (book) dialog.current?.showModal();
    else dialog.current?.close();
  }, [book]);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!book) return;
    const data = new FormData(event.currentTarget);
    const text = (name: string) => String(data.get(name) ?? "").trim();
    dispatch({
      type: "lend",
      bookId: book.id,
      loan: { borrower: text("borrower"), loanedOn: text("loanedOn"), dueOn: text("dueOn") || null },
    });
    onClose();
  };

  const field = "flex flex-col gap-1 text-sm";
  const input = "h-10 rounded-lg border border-line-strong bg-surface px-3 text-ink";

  return (
    <dialog
      ref={dialog}
      onClose={onClose}
      aria-labelledby="loan-title"
      className="m-auto w-[min(420px,calc(100vw-32px))] rounded-2xl border border-line bg-bg p-0 text-ink shadow-2xl backdrop:bg-black/40"
    >
      {book && (
        <form key={book.id} onSubmit={submit} className="flex flex-col gap-4 p-6">
          <h2 id="loan-title" className="flex items-center gap-2 text-lg font-semibold">
            <HandHelping size={20} className="text-tone-loan" aria-hidden="true" />
            Presta «{book.title}»
          </h2>
          <label className={field}>
            A chi
            <input name="borrower" required autoFocus className={input} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className={field}>
              Dal
              <input name="loanedOn" type="date" required defaultValue={start} className={input} />
            </label>
            <label className={field}>
              Restituzione entro
              <input name="dueOn" type="date" defaultValue={addDays(start, defaultLoanDays)} className={input} />
            </label>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="h-10 rounded-lg border border-line-strong px-4">
              Annulla
            </button>
            <button type="submit" className="h-10 rounded-lg bg-accent px-4 font-semibold text-accent-ink">
              Presta
            </button>
          </div>
        </form>
      )}
    </dialog>
  );
}
