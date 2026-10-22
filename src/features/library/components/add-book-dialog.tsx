"use client";

import { parseIsbn } from "@/server/core/books/isbn";
import type { SearchHit } from "@/server/core/books/ports";
import type { SearchField, SourceInfo } from "@/server/core/books/search";
import {
  AlertTriangle,
  ArrowLeft,
  BookPlus,
  CheckCircle2,
  ExternalLink,
  LoaderCircle,
  PenLine,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { loadSources, saveBook, searchOnline, type ApiError, type SaveResult } from "../../add-book/api";
import { emptyForm, formFromDraft, toLibraryBook, validateForm, type BookForm, type FormIssues } from "../../add-book/form";
import { useT } from "../../i18n/i18n-context";
import type { Messages } from "../../i18n/messages";
import { useLibrary } from "./library-context";
import { SourceIcon } from "./source-icons";

type Origin = { readonly source: SourceInfo; readonly hit: SearchHit } | null;

type Stage =
  | { readonly kind: "choose" }
  | { readonly kind: "source"; readonly sources: readonly SourceInfo[] | null }
  | { readonly kind: "search"; readonly source: SourceInfo }
  | { readonly kind: "form"; readonly form: BookForm; readonly origin: Origin; readonly back: Stage }
  | { readonly kind: "saving"; readonly form: BookForm; readonly origin: Origin; readonly back: Stage }
  | { readonly kind: "done"; readonly title: string; readonly result: SaveResult };

type SearchState =
  | { readonly kind: "idle" }
  | { readonly kind: "loading" }
  | { readonly kind: "results"; readonly hits: readonly SearchHit[] }
  | { readonly kind: "error"; readonly error: ApiError };

const choose: Stage = { kind: "choose" };

const searchFields: readonly SearchField[] = ["any", "isbn", "title", "author"];

const errorText = (t: Messages, error: ApiError) =>
  error.kind === "server" ? t.addBook.errors.server(error.status) : t.addBook.errors[error.kind];

const button = "flex h-10 items-center justify-center gap-2 rounded-lg px-4";
const input =
  "h-10 w-full rounded-lg border border-line-strong bg-surface px-3 text-sm outline-none focus:border-accent";

function Notice({ tone, children }: { tone: "ok" | "warn"; children: ReactNode }) {
  const Icon = tone === "ok" ? CheckCircle2 : AlertTriangle;
  return (
    <p className={`flex gap-2 text-sm ${tone === "ok" ? "text-ink" : "text-[#b54708]"}`}>
      <Icon size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}

function ChoiceCard({
  icon,
  title,
  text,
  onClick,
}: {
  icon: ReactNode;
  title: string;
  text: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-start gap-3 rounded-xl border border-line-strong bg-surface p-4 text-left hover:border-accent hover:bg-selected"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-chip text-accent">{icon}</span>
      <span className="flex flex-col gap-0.5">
        <span className="font-semibold">{title}</span>
        <span className="text-sm text-muted">{text}</span>
      </span>
    </button>
  );
}

function Thumb({ url }: { url: string | null | undefined }) {
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element -- copertine da domini esterni qualsiasi
    <img src={url} alt="" className="h-[72px] w-12 shrink-0 rounded-[2px_4px_4px_2px] object-cover shadow" />
  ) : (
    <div className="flex h-[72px] w-12 shrink-0 items-center justify-center rounded-[2px_4px_4px_2px] bg-chip text-muted">
      <BookPlus size={18} aria-hidden="true" />
    </div>
  );
}

function SearchPanel({ source, onPick }: { source: SourceInfo; onPick: (hit: SearchHit) => void }) {
  const [field, setField] = useState<SearchField>("any");
  const [text, setText] = useState("");
  const [search, setSearch] = useState<SearchState>({ kind: "idle" });
  const t = useT();

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!text.trim()) return;
    setSearch({ kind: "loading" });
    searchOnline({ source: source.id, field, text }).then((result) =>
      setSearch(result.ok ? { kind: "results", hits: result.value } : { kind: "error", error: result.error }),
    );
  };

  return (
    <div className="flex flex-col gap-3">
      <form onSubmit={submit} className="flex flex-col gap-2 sm:flex-row">
        <select
          aria-label={t.addBook.searchIn}
          value={field}
          onChange={(event) => setField(event.target.value as SearchField)}
          className={`${input} sm:w-28`}
        >
          {searchFields.map((value) => (
            <option key={value} value={value}>
              {t.addBook.fields[value]}
            </option>
          ))}
        </select>
        <input
          type="search"
          autoFocus
          aria-label={t.addBook.searchText}
          placeholder={t.addBook.placeholders[field]}
          value={text}
          onChange={(event) => setText(event.target.value)}
          className={input}
        />
        <button
          type="submit"
          disabled={!text.trim() || search.kind === "loading"}
          className={`${button} shrink-0 bg-accent font-semibold text-accent-ink disabled:opacity-50`}
        >
          <Search size={16} aria-hidden="true" />
          {t.addBook.search}
        </button>
      </form>

      {search.kind === "loading" && (
        <p className="flex items-center gap-2 text-sm text-ink-soft">
          <LoaderCircle size={16} className="animate-spin" aria-hidden="true" />
          {t.addBook.searching(source.label)}
        </p>
      )}
      {search.kind === "error" && <Notice tone="warn">{errorText(t, search.error)}</Notice>}
      {search.kind === "results" && search.hits.length === 0 && (
        <Notice tone="warn">{t.addBook.noResults(source.label)}</Notice>
      )}
      {search.kind === "results" && search.hits.length > 0 && (
        <ul className="flex max-h-[min(420px,50dvh)] flex-col divide-y divide-line overflow-auto rounded-xl border border-line">
          {search.hits.map((hit) => (
            <li key={hit.sourceId} className="flex items-center gap-3 p-2.5">
              <Thumb url={hit.draft.cover_url} />
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold">{hit.draft.title}</div>
                {hit.draft.authors && hit.draft.authors.length > 0 && (
                  <div className="truncate text-sm text-ink-soft">{hit.draft.authors.join(", ")}</div>
                )}
                <div className="truncate text-xs text-muted">
                  {[hit.draft.publisher, hit.draft.published_year, hit.draft.isbn13 && `ISBN ${hit.draft.isbn13}`]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {hit.link && (
                  <a
                    href={hit.link}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={t.addBook.openOn(source.label)}
                    className="rounded-lg p-2 text-muted hover:bg-chip"
                  >
                    <ExternalLink size={16} />
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => onPick(hit)}
                  className="h-9 rounded-lg border border-line-strong bg-surface px-3 text-sm font-medium hover:bg-chip"
                >
                  {t.addBook.use}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {search.kind === "idle" && (
        <p className="text-xs text-muted">
          {t.addBook.pickHint}
        </p>
      )}
    </div>
  );
}

function Field({
  label,
  issue,
  wide,
  children,
}: {
  label: string;
  issue?: string;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <label className={`flex flex-col gap-1 text-sm ${wide ? "sm:col-span-2" : ""}`}>
      <span className="text-ink-soft">{label}</span>
      {children}
      {issue && <span className="text-xs text-[#b42318]">{issue}</span>}
    </label>
  );
}

function BookFormPanel({
  form,
  issues,
  origin,
  duplicate,
  onChange,
}: {
  form: BookForm;
  issues: FormIssues;
  origin: Origin;
  duplicate: string | null;
  onChange: (form: BookForm) => void;
}) {
  const t = useT();
  const issueOf = (key: keyof BookForm) =>
    issues.includes(key) ? (key === "title" ? t.addBook.titleRequired : t.addBook.invalidValue) : undefined;
  const text = (key: Exclude<keyof BookForm, "summary">, options: { wide?: boolean; inputMode?: "numeric" } = {}) => (
    <Field label={t.addBook.form[key]} issue={issueOf(key)} wide={options.wide}>
      <input
        value={form[key]}
        inputMode={options.inputMode}
        onChange={(event) => onChange({ ...form, [key]: event.target.value })}
        className={input}
      />
    </Field>
  );
  return (
    <div className="flex max-h-[min(520px,60dvh)] flex-col gap-3 overflow-auto pr-1">
      {origin && (
        <p className="flex items-center gap-2 text-xs text-muted">
          <Sparkles size={14} className="text-accent" aria-hidden="true" />
          {t.addBook.filledBy(origin.source.label)}
        </p>
      )}
      {duplicate && <Notice tone="warn">{t.addBook.duplicate(duplicate)}</Notice>}
      <div className="flex gap-4">
        <Thumb url={form.coverUrl || null} />
        <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2">
          {text("title", { wide: true })}
          {text("subtitle", { wide: true })}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {text("authors", { wide: true })}
        {text("publisher")}
        {text("year", { inputMode: "numeric" })}
        {text("isbn")}
        {text("pages", { inputMode: "numeric" })}
        {text("language")}
        {text("genres")}
        {text("coverUrl", { wide: true })}
        <Field label={t.addBook.form.summary} issue={issueOf("summary")} wide>
          <textarea
            rows={4}
            value={form.summary}
            onChange={(event) => onChange({ ...form, summary: event.target.value })}
            className={`${input} h-auto py-2`}
          />
        </Field>
      </div>
    </div>
  );
}

const titleOf = (t: Messages, kind: Stage["kind"]) => {
  switch (kind) {
    case "choose":
      return t.addBook.title;
    case "source":
      return t.addBook.automatic;
    case "search":
      return t.addBook.searchTitle;
    case "form":
    case "saving":
      return t.addBook.formTitle;
    case "done":
      return t.addBook.doneTitle;
  }
};

export function AddBookDialog() {
  const { state, dispatch } = useLibrary();
  const t = useT();
  const dialog = useRef<HTMLDialogElement>(null);
  const [stage, setStage] = useState<Stage>(choose);
  const [issues, setIssues] = useState<FormIssues>([]);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    if (state.addOpen) dialog.current?.showModal();
    else dialog.current?.close();
  }, [state.addOpen]);

  const go = (next: Stage) => {
    setIssues([]);
    setProblem(null);
    setStage(next);
  };

  const close = () => {
    if (stage.kind === "saving") return;
    dispatch({ type: "setAddOpen", open: false });
    go(choose);
  };

  const openSources = () => {
    go({ kind: "source", sources: null });
    loadSources().then((sources) =>
      setStage((current) => (current.kind === "source" ? { kind: "source", sources } : current)),
    );
  };

  const back = (): Stage | null => {
    switch (stage.kind) {
      case "source":
        return choose;
      case "search":
        return { kind: "source", sources: null };
      case "form":
        return stage.back;
      default:
        return null;
    }
  };
  const previous = back();

  const goBack = () => {
    if (!previous) return;
    if (previous.kind === "source") openSources();
    else go(previous);
  };

  const save = (form: BookForm, origin: Origin, backTo: Stage) => {
    const checked = validateForm(form);
    if (!checked.ok) {
      setIssues(checked.issues);
      return;
    }
    setStage({ kind: "saving", form, origin, back: backTo });
    saveBook(checked.book).then((result) => {
      if (result.kind !== "failed") {
        const id = result.kind === "saved" ? result.id : `local:${crypto.randomUUID()}`;
        dispatch({ type: "addBook", book: toLibraryBook(id, checked.book, new Date().toISOString()) });
        go({ kind: "done", title: checked.book.title, result });
      } else {
        setStage({ kind: "form", form, origin, back: backTo });
        setProblem(t.addBook.saveFailed(errorText(t, result.error)));
      }
    });
  };

  const duplicateOf = (form: BookForm) => {
    const isbn13 = parseIsbn(form.isbn)?.isbn13;
    return (isbn13 && state.library.books.find((book) => book.isbn13 === isbn13)?.title) || null;
  };

  return (
    <dialog
      ref={dialog}
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      aria-labelledby="add-book-title"
      className="m-auto w-[min(600px,calc(100vw-32px))] rounded-2xl border border-line bg-bg p-0 text-ink shadow-2xl backdrop:bg-black/40"
    >
      <div className="flex flex-col gap-4 p-6">
        <div className="flex items-center gap-2">
          {previous && (
            <button type="button" aria-label={t.common.back} onClick={goBack} className="rounded-lg p-1.5 text-muted hover:bg-chip">
              <ArrowLeft size={18} />
            </button>
          )}
          <h2 id="add-book-title" className="mr-auto flex items-center gap-2 text-lg font-semibold">
            <BookPlus size={20} className="text-accent" aria-hidden="true" />
            {titleOf(t, stage.kind)}
            {stage.kind === "search" && (
              <span className="flex items-center gap-1.5 font-normal text-muted">
                · <SourceIcon id={stage.source.id} size={16} /> {stage.source.label}
              </span>
            )}
          </h2>
          <button
            type="button"
            aria-label={t.common.close}
            onClick={close}
            disabled={stage.kind === "saving"}
            className="rounded-lg p-1.5 text-muted hover:bg-chip disabled:opacity-40"
          >
            <X size={18} />
          </button>
        </div>

        {stage.kind === "choose" && (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-ink-soft">{t.addBook.how}</p>
            <ChoiceCard
              icon={<PenLine size={20} />}
              title={t.addBook.manual}
              text={t.addBook.manualHint}
              onClick={() => go({ kind: "form", form: emptyForm, origin: null, back: choose })}
            />
            <ChoiceCard
              icon={<Sparkles size={20} />}
              title={t.addBook.automatic}
              text={t.addBook.automaticHint}
              onClick={openSources}
            />
          </div>
        )}

        {stage.kind === "source" && (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-ink-soft">{t.addBook.whichSource}</p>
            {stage.sources === null ? (
              <p className="flex items-center gap-2 text-sm text-ink-soft">
                <LoaderCircle size={16} className="animate-spin" aria-hidden="true" />
                {t.addBook.loadingSources}
              </p>
            ) : (
              stage.sources.map((source) => (
                <ChoiceCard
                  key={source.id}
                  icon={<SourceIcon id={source.id} />}
                  title={source.label}
                  text={t.addBook.sources[source.id] ?? t.addBook.otherSource}
                  onClick={() => go({ kind: "search", source })}
                />
              ))
            )}
          </div>
        )}

        {stage.kind === "search" && (
          <SearchPanel
            key={stage.source.id}
            source={stage.source}
            onPick={(hit) =>
              go({ kind: "form", form: formFromDraft(hit.draft), origin: { source: stage.source, hit }, back: stage })
            }
          />
        )}

        {(stage.kind === "form" || stage.kind === "saving") && (
          <BookFormPanel
            form={stage.form}
            issues={issues}
            origin={stage.origin}
            duplicate={duplicateOf(stage.form)}
            onChange={(form) => stage.kind === "form" && setStage({ ...stage, form })}
          />
        )}

        {problem && <Notice tone="warn">{problem}</Notice>}

        {stage.kind === "done" && (
          <div className="flex flex-col gap-2">
            <Notice tone="ok">{t.addBook.added(stage.title)}</Notice>
            {stage.result.kind === "local" && (
              <Notice tone="warn">{t.addBook.notSaved(errorText(t, stage.result.error))}</Notice>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          {(stage.kind === "form" || stage.kind === "saving") && (
            <button
              type="button"
              disabled={stage.kind === "saving"}
              onClick={() => stage.kind === "form" && save(stage.form, stage.origin, stage.back)}
              className={`${button} bg-accent font-semibold text-accent-ink disabled:opacity-60`}
            >
              {stage.kind === "saving" && <LoaderCircle size={16} className="animate-spin" aria-hidden="true" />}
              {t.addBook.saveToLibrary}
            </button>
          )}
          {stage.kind === "done" && (
            <>
              <button type="button" onClick={() => go(choose)} className={`${button} border border-line-strong`}>
                {t.addBook.another}
              </button>
              <button type="button" onClick={close} className={`${button} bg-accent font-semibold text-accent-ink`}>
                {t.common.done}
              </button>
            </>
          )}
        </div>
      </div>
    </dialog>
  );
}
