-- Colonne personalizzate della tabella, per tutta la biblioteca.
-- Le crea un bibliotecario o un amministratore, oppure un import (.pedia) per i campi
-- che il catalogo non ha. I valori stanno nei libri:
--   catalog_field null  → books.extra, alla chiave che normalizzata vale `key`
--                          ("Place Published", "placePublished" → placepublished)
--   catalog_field set   → la colonna del libro con quel nome (es. translators, edition)

create table public.custom_columns (
  key text primary key check (key ~ '^[a-z0-9]{1,60}$'),
  label text not null check (length(trim(label)) between 1 and 80),
  kind text not null default 'text' check (kind in ('text', 'number', 'date')),
  extra_key text check (length(extra_key) between 1 and 200),
  catalog_field text check (catalog_field in (
    'editors', 'translators', 'illustrators', 'edition', 'condition', 'signed',
    'purchased_on', 'purchased_from', 'purchase_price', 'estimated_value',
    'started_reading_on', 'finished_reading_on', 'favorite'
  )),
  position integer not null default 0,
  constraint custom_columns_source check ((extra_key is null) <> (catalog_field is null)),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index custom_columns_position_idx on public.custom_columns (position, created_at);

create trigger custom_columns_set_updated_at
  before update on public.custom_columns
  for each row execute function public.set_updated_at();

create trigger custom_columns_set_created_by
  before insert on public.custom_columns
  for each row execute function public.set_created_by();

alter table public.custom_columns enable row level security;

-- Come il catalogo: tutti i membri leggono, bibliotecari e admin scrivono.
create policy "custom_columns: members read" on public.custom_columns
  for select to authenticated using ((select public.has_role('reader')));
create policy "custom_columns: librarians insert" on public.custom_columns
  for insert to authenticated with check ((select public.has_role('librarian')));
create policy "custom_columns: librarians update" on public.custom_columns
  for update to authenticated
  using ((select public.has_role('librarian')))
  with check ((select public.has_role('librarian')));
create policy "custom_columns: librarians delete" on public.custom_columns
  for delete to authenticated using ((select public.has_role('librarian')));

revoke all on public.custom_columns from anon;

-- Scrive (o toglie, con null) un valore in books.extra senza riscrivere gli altri:
-- due persone che compilano colonne diverse dello stesso libro non si sovrascrivono.
-- security invoker: valgono la RLS e i ruoli di chi chiama. Restituisce false se il libro non c'è.
create or replace function public.set_book_field(book_id uuid, field_key text, field_value text)
returns boolean
language sql
security invoker
set search_path = ''
as $$
  with updated as (
    update public.books b
    set extra = case
      when field_value is null or trim(field_value) = '' then b.extra - field_key
      else b.extra || jsonb_build_object(field_key, trim(field_value))
    end
    where b.id = book_id
    returning b.id
  )
  select exists (select 1 from updated);
$$;

revoke execute on function public.set_book_field(uuid, text, text) from public, anon;
grant execute on function public.set_book_field(uuid, text, text) to authenticated;
