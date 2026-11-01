import { errAsync, okAsync } from "neverthrow";
import type { CustomColumn } from "../../core/columns/column";
import type { ColumnStore } from "../../core/columns/ports";
import { notFound } from "../../core/errors";
import { run } from "./book-store";
import type { Supabase } from "./client";

const fields = "key, label, kind, catalog_field, extra_key, position, created_at";

type Row = {
  key: string;
  label: string;
  kind: CustomColumn["kind"];
  catalog_field: string | null;
  extra_key: string | null;
  position: number;
  created_at: string;
};

const toColumn = (row: Row): CustomColumn => ({
  ...row,
  catalog_field: row.catalog_field as CustomColumn["catalog_field"],
});

export const supabaseColumnStore = (supabase: Supabase): ColumnStore => {
  const table = () => supabase.from("custom_columns");
  const list = () =>
    run(table().select(fields).order("position").order("created_at").order("key")).map((rows) => rows.map(toColumn));

  return {
    list,

    // Le nuove vanno in fondo, nell'ordine ricevuto; quelle che ci sono già non cambiano.
    ensure: (columns) =>
      list().andThen((existing) => {
        const known = new Set(existing.map((column) => column.key));
        const start = existing.reduce((max, column) => Math.max(max, column.position + 1), 0);
        const missing = columns
          .filter((column) => !known.has(column.key))
          .map((column, index) => ({ ...column, position: start + index }));
        return missing.length === 0
          ? okAsync(existing)
          : run(table().upsert(missing, { onConflict: "key", ignoreDuplicates: true }).select("key")).andThen(list);
      }),

    remove: (key) => run(table().delete().eq("key", key).select("key")).map(() => undefined),

    setValue: (bookId, extraKey, value) =>
      run(supabase.rpc("set_book_field", { book_id: bookId, field_key: extraKey, field_value: value })).andThen((found) =>
        found ? okAsync(undefined) : errAsync(notFound),
      ),
  };
};
