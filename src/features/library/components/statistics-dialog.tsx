"use client";

import { ChartColumn, X } from "lucide-react";
import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { useI18n } from "../../i18n/i18n-context";
import type { ValueFilter } from "../model";
import { libraryStats, percent, type ActiveLoan } from "../stats";
import { useLibrary } from "./library-context";

type Row = { readonly label: string; readonly count: number; readonly filter?: ValueFilter };

const useFormat = () => {
  const { locale } = useI18n();
  return useMemo(() => {
    const integer = new Intl.NumberFormat(locale);
    const decimal = new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    const date = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
    return {
      integer: (n: number) => integer.format(n),
      decimal: (n: number) => decimal.format(n),
      date: (iso: string) => date.format(new Date(iso)),
    };
  }, [locale]);
};

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-xl border border-line bg-surface px-4 py-3">
      <span className="text-xs font-semibold tracking-wide text-muted uppercase">{label}</span>
      <span className="font-display text-2xl font-bold tabular-nums">{value}</span>
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </div>
  );
}

function Card({ title, children, className = "" }: { title: string; children: ReactNode; className?: string }) {
  const id = `stats-${title.replace(/\W+/g, "-").toLowerCase()}`;
  return (
    <section aria-labelledby={id} className={`flex min-w-0 flex-col gap-3 rounded-xl border border-line bg-surface p-4 ${className}`}>
      <h3 id={id} className="text-xs font-bold tracking-wider text-muted uppercase">
        {title}
      </h3>
      {children}
    </section>
  );
}

/** Barre orizzontali: nome, barra lunga quanto il valore, numero. Con un filtro la riga porta ai libri. */
function BarList({ rows }: { rows: readonly Row[] }) {
  const { t } = useI18n();
  const { dispatch } = useLibrary();
  const format = useFormat();
  const max = Math.max(1, ...rows.map((row) => row.count));
  if (rows.length === 0) return <p className="text-sm text-muted">{t.stats.noData}</p>;
  return (
    <ul className="flex flex-col gap-1">
      {rows.map((row) => {
        const content = (
          <>
            <span className="w-[38%] shrink-0 truncate text-left" title={row.label}>
              {row.label}
            </span>
            <span className="flex h-2.5 flex-1 items-center" aria-hidden="true">
              <span
                className="h-full rounded-r bg-accent"
                style={{ width: `${Math.max(2, (row.count / max) * 100)}%` }}
              />
            </span>
            <span className="w-12 shrink-0 text-right text-ink-soft tabular-nums">{format.integer(row.count)}</span>
          </>
        );
        return (
          <li key={row.label}>
            {row.filter ? (
              <button
                type="button"
                onClick={() => row.filter && dispatch({ type: "showInLibrary", filter: row.filter })}
                title={t.stats.showBooks(row.label, row.count)}
                aria-label={t.stats.showBooks(row.label, row.count)}
                className="flex w-full items-center gap-3 rounded-md px-1.5 py-1 text-sm hover:bg-chip touch:py-2"
              >
                {content}
              </button>
            ) : (
              <div title={t.stats.bar(row.label, row.count)} className="flex items-center gap-3 px-1.5 py-1 text-sm">
                {content}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** Colonne verticali per gli andamenti nel tempo (decenni, anni). `axis` è l'etichetta corta sotto la colonna. */
function Columns({ rows }: { rows: readonly (Row & { readonly axis: string })[] }) {
  const { t } = useI18n();
  const format = useFormat();
  const max = Math.max(1, ...rows.map((row) => row.count));
  if (rows.length === 0) return <p className="text-sm text-muted">{t.stats.noData}</p>;
  // Con molte colonne si etichetta solo una ogni tanto, per non accavallarle.
  const every = Math.ceil(rows.length / 7);
  return (
    <ul className="flex items-end gap-0.5">
      {rows.map((row, index) => (
        <li
          key={row.label}
          title={t.stats.bar(row.label, row.count)}
          className="group flex min-w-0 flex-1 flex-col items-center gap-1"
        >
          <span className="sr-only">{t.stats.bar(row.label, row.count)}</span>
          <span className="text-[10px] text-muted tabular-nums opacity-0 group-hover:opacity-100" aria-hidden="true">
            {format.integer(row.count)}
          </span>
          <span aria-hidden="true" className="flex h-32 w-full items-end">
            <span
              className="w-full rounded-t bg-accent group-hover:opacity-80"
              style={{ height: `${row.count === 0 ? 0 : Math.max(2, (row.count / max) * 100)}%` }}
            />
          </span>
          <span aria-hidden="true" className="h-4 text-[10px] whitespace-nowrap text-muted">
            {index % every === 0 ? row.axis : ""}
          </span>
        </li>
      ))}
    </ul>
  );
}

function LoanList({ loans }: { loans: readonly ActiveLoan[] }) {
  const { t } = useI18n();
  const { dispatch, state } = useLibrary();
  const format = useFormat();
  if (loans.length === 0) return <p className="text-sm text-muted">{t.stats.noLoans}</p>;
  const loaned = state.library.collections.find((item) => item.kind === "loaned");
  const open = (bookId: string) => {
    dispatch({ type: "setStatsOpen", open: false });
    if (loaned) dispatch({ type: "selectCollection", collectionId: loaned.id });
    dispatch({ type: "openBook", bookId });
  };
  return (
    <ul className="flex max-h-72 flex-col divide-y divide-line overflow-y-auto">
      {loans.map((loan) => (
        <li key={loan.book.id}>
          <button
            type="button"
            onClick={() => open(loan.book.id)}
            title={t.stats.open}
            className="flex w-full flex-wrap items-baseline gap-x-3 gap-y-0.5 rounded-md px-1.5 py-2 text-left text-sm hover:bg-chip"
          >
            <span className="min-w-0 flex-1 truncate font-medium">{loan.book.title}</span>
            <span className="text-ink-soft">{loan.borrower}</span>
            <span className={`w-full text-xs ${loan.daysLate > 0 ? "font-semibold text-danger" : "text-muted"}`}>
              {t.stats.since(format.date(loan.loanedOn))}
              {loan.dueOn && ` · ${t.stats.due(format.date(loan.dueOn))}`}
              {loan.daysLate > 0 && ` · ${t.stats.late(loan.daysLate)}`}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function StatisticsBody() {
  const { t } = useI18n();
  const { state, today } = useLibrary();
  const format = useFormat();
  const stats = useMemo(() => libraryStats(state.library, today), [state.library, today]);
  if (stats.total === 0) return <p className="py-10 text-center text-muted">{t.stats.empty}</p>;
  const read = stats.readStatus.find((item) => item.status === "read")?.count ?? 0;
  const tallied = (field: ValueFilter["field"] | null) => (rows: readonly { value: string; count: number }[]) =>
    rows.map((row) => ({ label: row.value, count: row.count, filter: field ? { field, value: row.value } : undefined }));
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted">{t.stats.scope}</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Tile label={t.stats.books} value={format.integer(stats.total)} />
        <Tile label={t.stats.authors} value={format.integer(stats.authors)} />
        <Tile label={t.stats.read} value={format.integer(read)} hint={t.stats.readHint(percent(read, stats.total))} />
        <Tile label={t.stats.pages} value={format.integer(stats.pages)} hint={t.stats.pagesHint(stats.withPages)} />
        <Tile
          label={t.stats.averageRating}
          value={stats.averageRating === null ? "–" : `${format.decimal(stats.averageRating)}★`}
          hint={t.stats.ratedHint(stats.rated)}
        />
        <Tile label={t.stats.onLoan} value={format.integer(stats.loans.length)} hint={t.stats.overdueHint(stats.overdue)} />
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Card title={t.stats.readStatus}>
          <BarList
            rows={stats.readStatus.map(({ status, count }) => ({
              label: t.readStatus[status],
              count,
              filter: { field: "readStatus", value: status },
            }))}
          />
        </Card>
        <Card title={t.stats.topAuthors}>
          <BarList rows={tallied("authors")(stats.topAuthors)} />
        </Card>
        <Card title={t.stats.topGenres}>
          <BarList rows={tallied("genres")(stats.topGenres)} />
        </Card>
        <Card title={t.stats.decades}>
          <Columns rows={stats.decades.map(({ decade, count }) => ({ label: t.stats.decade(decade), axis: String(decade), count }))} />
        </Card>
        <Card title={t.stats.addedByYear}>
          <Columns rows={stats.addedByYear.map(({ year, count }) => ({ label: String(year), axis: String(year), count }))} />
        </Card>
        <Card title={t.stats.ratings}>
          <BarList rows={[...stats.ratings].reverse().map(({ stars, count }) => ({ label: t.stats.stars(stars), count }))} />
        </Card>
        <Card title={t.stats.topPublishers}>
          <BarList rows={tallied("publisher")(stats.topPublishers)} />
        </Card>
        <Card title={t.stats.languages}>
          <BarList rows={tallied(null)(stats.languages)} />
        </Card>
        <Card title={t.stats.formats}>
          <BarList rows={tallied(null)(stats.formats)} />
        </Card>
        <Card title={t.stats.loans} className="md:col-span-2">
          <LoanList loans={stats.loans} />
        </Card>
        <Card title={t.stats.topBorrowers}>
          <BarList rows={tallied(null)(stats.topBorrowers)} />
        </Card>
      </div>
    </div>
  );
}

/** Statistiche della Libreria: si aprono dalla voce "Statistiche" della barra laterale o del telefono. */
export function StatisticsDialog() {
  const { state, dispatch } = useLibrary();
  const { t } = useI18n();
  const dialog = useRef<HTMLDialogElement>(null);
  const open = state.statsOpen;
  const close = () => dispatch({ type: "setStatsOpen", open: false });

  useEffect(() => {
    if (open) dialog.current?.showModal();
    else dialog.current?.close();
  }, [open]);

  return (
    <dialog
      ref={dialog}
      onClose={close}
      onClick={(event) => event.target === dialog.current && close()}
      aria-labelledby="stats-title"
      className="m-0 h-dvh max-h-none w-full max-w-none bg-bg p-0 text-ink shadow-2xl backdrop:bg-black/40 md:m-auto md:h-[min(90dvh,960px)] md:w-[min(92vw,1180px)] md:rounded-2xl md:border md:border-line"
    >
      <div className="flex h-full flex-col">
        <header className="flex items-center gap-2 border-b border-line px-5 py-4">
          <ChartColumn size={20} className="text-muted" aria-hidden="true" />
          <h2 id="stats-title" className="flex-1 font-display text-xl font-bold">
            {t.stats.title}
          </h2>
          <button
            type="button"
            onClick={close}
            aria-label={t.common.close}
            className="flex size-9 items-center justify-center rounded-lg text-ink-soft hover:bg-chip"
          >
            <X size={18} />
          </button>
        </header>
        <div className="flex-1 overflow-auto bg-panel px-5 py-5">{open && <StatisticsBody />}</div>
      </div>
    </dialog>
  );
}
