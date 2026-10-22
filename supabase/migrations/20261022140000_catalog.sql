-- Catalogo personale: libri, collezioni e prestiti.
-- Ogni riga appartiene a un utente (owner_id) e la RLS limita l'accesso al proprietario.

create extension if not exists unaccent with schema extensions;

-- Funzioni di supporto ------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- unaccent() non è IMMUTABLE, quindi serve un wrapper per usarlo in una colonna generata.
create or replace function public.immutable_unaccent(value text)
returns text
language sql
immutable
parallel safe
strict
set search_path = ''
as $$
  select extensions.unaccent('extensions.unaccent'::regdictionary, value);
$$;

create or replace function public.array_to_text(value text[])
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select coalesce(array_to_string(value, ' '), '');
$$;

-- Tipi ----------------------------------------------------------------------

create type public.read_status as enum ('unread', 'reading', 'read', 'abandoned');

-- Libri ---------------------------------------------------------------------

create table public.books (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,

  -- Bibliografia
  title text not null check (length(trim(title)) > 0),
  subtitle text,
  authors text[] not null default '{}',
  editors text[] not null default '{}',
  translators text[] not null default '{}',
  illustrators text[] not null default '{}',
  publisher text,
  published_year smallint check (published_year between 0 and 9999),
  edition text,
  isbn13 text check (isbn13 ~ '^97[89][0-9]{10}$'),
  isbn10 text check (isbn10 ~ '^[0-9]{9}[0-9X]$'),
  pages integer check (pages > 0),
  format text,
  language text,
  genres text[] not null default '{}',
  series text,
  series_number numeric(6, 2),
  summary text,
  cover_path text,
  cover_url text,

  -- Copia personale
  read_status public.read_status not null default 'unread',
  started_reading_on date,
  finished_reading_on date,
  rating smallint check (rating between 0 and 5),
  favorite boolean not null default false,
  notes text,
  tags text[] not null default '{}',
  location text,
  condition text,
  signed boolean not null default false,
  purchased_on date,
  purchased_from text,
  purchase_price numeric(10, 2) check (purchase_price >= 0),
  estimated_value numeric(10, 2) check (estimated_value >= 0),
  currency char(3),

  -- Import (es. file .pedia di Bookpedia): permette di reimportare senza duplicati.
  source text,
  source_id text,
  extra jsonb not null default '{}',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  search tsvector generated always as (
    setweight(to_tsvector('simple', public.immutable_unaccent(coalesce(title, '') || ' ' || coalesce(subtitle, ''))), 'A') ||
    setweight(to_tsvector('simple', public.immutable_unaccent(public.array_to_text(authors) || ' ' || coalesce(series, ''))), 'B') ||
    setweight(to_tsvector('simple', public.immutable_unaccent(
      coalesce(publisher, '') || ' ' || coalesce(isbn13, '') || ' ' || coalesce(isbn10, '') || ' ' ||
      public.array_to_text(genres) || ' ' || public.array_to_text(tags)
    )), 'C')
  ) stored,

  constraint books_source_pair check ((source is null) = (source_id is null)),
  constraint books_reading_dates check (
    started_reading_on is null or finished_reading_on is null or started_reading_on <= finished_reading_on
  )
);

create index books_owner_created_idx on public.books (owner_id, created_at desc);
create index books_owner_title_idx on public.books (owner_id, lower(title));
create index books_owner_isbn13_idx on public.books (owner_id, isbn13) where isbn13 is not null;
create unique index books_owner_source_idx on public.books (owner_id, source, source_id) where source is not null;
create index books_search_idx on public.books using gin (search);
create index books_tags_idx on public.books using gin (tags);

create trigger books_set_updated_at
  before update on public.books
  for each row execute function public.set_updated_at();

-- Collezioni (scaffali) -----------------------------------------------------

create table public.collections (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  description text,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, name)
);

create trigger collections_set_updated_at
  before update on public.collections
  for each row execute function public.set_updated_at();

create table public.collection_books (
  collection_id uuid not null references public.collections (id) on delete cascade,
  book_id uuid not null references public.books (id) on delete cascade,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (collection_id, book_id)
);

create index collection_books_book_idx on public.collection_books (book_id);

-- Prestiti ------------------------------------------------------------------

create table public.loans (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  book_id uuid not null references public.books (id) on delete cascade,
  borrower text not null check (length(trim(borrower)) > 0),
  loaned_on date not null default current_date,
  due_on date,
  returned_on date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (returned_on is null or returned_on >= loaned_on)
);

-- Un libro può avere al massimo un prestito aperto.
create unique index loans_one_open_per_book_idx on public.loans (book_id) where returned_on is null;
create index loans_owner_idx on public.loans (owner_id, loaned_on desc);

create trigger loans_set_updated_at
  before update on public.loans
  for each row execute function public.set_updated_at();

-- Row Level Security --------------------------------------------------------

alter table public.books enable row level security;
alter table public.collections enable row level security;
alter table public.collection_books enable row level security;
alter table public.loans enable row level security;

create policy "books: owner full access" on public.books
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "collections: owner full access" on public.collections
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

-- Le righe ponte e i prestiti devono puntare a oggetti dello stesso proprietario.
create policy "collection_books: owner full access" on public.collection_books
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (
    owner_id = (select auth.uid())
    and exists (select 1 from public.collections c where c.id = collection_id and c.owner_id = (select auth.uid()))
    and exists (select 1 from public.books b where b.id = book_id and b.owner_id = (select auth.uid()))
  );

create policy "loans: owner full access" on public.loans
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (
    owner_id = (select auth.uid())
    and exists (select 1 from public.books b where b.id = book_id and b.owner_id = (select auth.uid()))
  );

-- Copertine (Storage) -------------------------------------------------------
-- Percorso dei file: <user id>/<book id>.<ext>

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('covers', 'covers', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "covers: owner read" on storage.objects
  for select to authenticated
  using (bucket_id = 'covers' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "covers: owner insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'covers' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "covers: owner update" on storage.objects
  for update to authenticated
  using (bucket_id = 'covers' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "covers: owner delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'covers' and (storage.foldername(name))[1] = (select auth.uid())::text);
