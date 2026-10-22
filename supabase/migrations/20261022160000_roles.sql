-- Biblioteca condivisa con ruoli.
-- Ogni istanza ha un solo catalogo; chi può fare cosa lo decide il ruolo del membro:
--   reader     legge tutto
--   librarian  legge e modifica libri, collezioni, prestiti e copertine
--   admin      come librarian, più impostazioni dell'istanza e gestione utenti
-- Il primo utente registrato diventa admin; poi si entra solo su invito
-- (o con la registrazione aperta, se l'admin la attiva).

-- Ruoli e membri --------------------------------------------------------------

-- L'ordine conta: i confronti (>=) seguono l'ordine dei valori.
create type public.app_role as enum ('reader', 'librarian', 'admin');

create table public.members (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  display_name text check (length(display_name) <= 100),
  role public.app_role not null default 'reader',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger members_set_updated_at
  before update on public.members
  for each row execute function public.set_updated_at();

create table public.invitations (
  email text primary key check (email = lower(trim(email)) and email like '%_@_%'),
  role public.app_role not null default 'reader',
  invited_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '14 days'
);

-- Una sola riga: le impostazioni dell'istanza.
create table public.instance_settings (
  id boolean primary key default true check (id),
  open_signup boolean not null default false,
  -- Ruolo di chi si registra da solo quando la registrazione è aperta.
  signup_role public.app_role not null default 'reader' check (signup_role <> 'admin'),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);

insert into public.instance_settings default values;

create trigger instance_settings_set_updated_at
  before update on public.instance_settings
  for each row execute function public.set_updated_at();

-- Ruolo dell'utente corrente, null se non è un membro attivo.
-- security definer: la RLS di members non deve richiamare sé stessa.
create or replace function public.member_role()
returns public.app_role
language sql
stable
security definer
set search_path = ''
as $$
  select m.role from public.members m
  where m.user_id = (select auth.uid()) and m.active;
$$;

create or replace function public.has_role(required public.app_role)
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(public.member_role() >= required, false);
$$;

-- Per la pagina di login: se la registrazione è possibile senza invito.
--   first_admin  istanza vuota, chi si registra diventa admin
--   open         registrazione aperta
--   invite_only  serve un invito
create or replace function public.signup_mode()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when not exists (select 1 from public.members) then 'first_admin'
    when (select open_signup from public.instance_settings) then 'open'
    else 'invite_only'
  end;
$$;

-- Registrazione ---------------------------------------------------------------

-- Ogni nuovo utente di Supabase Auth diventa membro, oppure la registrazione fallisce.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  settings public.instance_settings;
  invited public.app_role;
  assigned public.app_role;
begin
  -- Il lock serializza le registrazioni: due "primi utenti" non possono diventare entrambi admin.
  select * into settings from public.instance_settings where id for update;

  select i.role into invited from public.invitations i
  where i.email = lower(new.email) and i.expires_at > now();

  assigned := case
    when not exists (select 1 from public.members) then 'admin'
    when invited is not null then invited
    when settings.open_signup then settings.signup_role
  end;

  if assigned is null then
    raise exception 'signup_closed: serve un invito per registrarsi'
      using errcode = 'P0001';
  end if;

  insert into public.members (user_id, email, display_name, role)
  values (
    new.id,
    lower(new.email),
    nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
    assigned
  );
  delete from public.invitations where email = lower(new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.members set email = lower(new.email) where user_id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row when (old.email is distinct from new.email)
  execute function public.handle_user_email_change();

-- Deve restare sempre almeno un admin attivo.
create or replace function public.keep_one_admin()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.role = 'admin' and old.active
    and (tg_op = 'DELETE' or new.role <> 'admin' or not new.active)
    and not exists (
      select 1 from public.members m
      where m.user_id <> old.user_id and m.role = 'admin' and m.active
    )
  then
    raise exception 'last_admin: l''istanza deve avere almeno un amministratore attivo'
      using errcode = 'P0001';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger members_keep_one_admin
  before update or delete on public.members
  for each row execute function public.keep_one_admin();

-- Gli utenti già esistenti diventano membri: il più vecchio admin, gli altri lettori.
insert into public.members (user_id, email, role)
select
  u.id,
  lower(coalesce(u.email, u.id::text)),
  case when row_number() over (order by u.created_at, u.id) = 1 then 'admin' else 'reader' end::public.app_role
from auth.users u
on conflict (user_id) do nothing;

-- Dati condivisi ----------------------------------------------------------------
-- owner_id diventa created_by: resta traccia di chi ha inserito la riga,
-- ma l'accesso non dipende più da lui.

drop policy "books: owner full access" on public.books;
drop policy "collections: owner full access" on public.collections;
drop policy "collection_books: owner full access" on public.collection_books;
drop policy "loans: owner full access" on public.loans;

drop index public.books_owner_created_idx;
drop index public.books_owner_title_idx;
drop index public.books_owner_isbn13_idx;
drop index public.books_owner_source_idx;
drop index public.loans_owner_idx;
alter table public.collections drop constraint collections_owner_id_name_key;
alter table public.collection_books drop column owner_id;

alter table public.books rename column owner_id to created_by;
alter table public.collections rename column owner_id to created_by;
alter table public.loans rename column owner_id to created_by;

alter table public.books drop constraint books_owner_id_fkey;
alter table public.collections drop constraint collections_owner_id_fkey;
alter table public.loans drop constraint loans_owner_id_fkey;

alter table public.books
  alter column created_by drop not null,
  add constraint books_created_by_fkey foreign key (created_by) references auth.users (id) on delete set null;
alter table public.collections
  alter column created_by drop not null,
  add constraint collections_created_by_fkey foreign key (created_by) references auth.users (id) on delete set null;
alter table public.loans
  alter column created_by drop not null,
  add constraint loans_created_by_fkey foreign key (created_by) references auth.users (id) on delete set null;

create index books_created_idx on public.books (created_at desc);
create index books_title_idx on public.books (lower(title));
create index books_isbn13_idx on public.books (isbn13) where isbn13 is not null;
create unique index books_source_idx on public.books (source, source_id) where source is not null;
create index loans_loaned_idx on public.loans (loaned_on desc);
alter table public.collections add constraint collections_name_key unique (name);

-- created_by lo decide il database, non il client.
create or replace function public.set_created_by()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.created_by = (select auth.uid());
  return new;
end;
$$;

create trigger books_set_created_by
  before insert on public.books
  for each row execute function public.set_created_by();
create trigger collections_set_created_by
  before insert on public.collections
  for each row execute function public.set_created_by();
create trigger loans_set_created_by
  before insert on public.loans
  for each row execute function public.set_created_by();

-- Row Level Security --------------------------------------------------------------

alter table public.members enable row level security;
alter table public.invitations enable row level security;
alter table public.instance_settings enable row level security;

-- Catalogo: tutti i membri leggono, bibliotecari e admin scrivono.
create policy "books: members read" on public.books
  for select to authenticated using ((select public.has_role('reader')));
create policy "books: librarians insert" on public.books
  for insert to authenticated with check ((select public.has_role('librarian')));
create policy "books: librarians update" on public.books
  for update to authenticated
  using ((select public.has_role('librarian')))
  with check ((select public.has_role('librarian')));
create policy "books: librarians delete" on public.books
  for delete to authenticated using ((select public.has_role('librarian')));

create policy "collections: members read" on public.collections
  for select to authenticated using ((select public.has_role('reader')));
create policy "collections: librarians insert" on public.collections
  for insert to authenticated with check ((select public.has_role('librarian')));
create policy "collections: librarians update" on public.collections
  for update to authenticated
  using ((select public.has_role('librarian')))
  with check ((select public.has_role('librarian')));
create policy "collections: librarians delete" on public.collections
  for delete to authenticated using ((select public.has_role('librarian')));

create policy "collection_books: members read" on public.collection_books
  for select to authenticated using ((select public.has_role('reader')));
create policy "collection_books: librarians insert" on public.collection_books
  for insert to authenticated with check ((select public.has_role('librarian')));
create policy "collection_books: librarians delete" on public.collection_books
  for delete to authenticated using ((select public.has_role('librarian')));

create policy "loans: members read" on public.loans
  for select to authenticated using ((select public.has_role('reader')));
create policy "loans: librarians insert" on public.loans
  for insert to authenticated with check ((select public.has_role('librarian')));
create policy "loans: librarians update" on public.loans
  for update to authenticated
  using ((select public.has_role('librarian')))
  with check ((select public.has_role('librarian')));
create policy "loans: librarians delete" on public.loans
  for delete to authenticated using ((select public.has_role('librarian')));

-- Membri: ognuno vede la propria riga, l'admin vede e modifica tutti.
-- Le righe nascono solo dal trigger di registrazione e spariscono con l'utente.
create policy "members: self or admin read" on public.members
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.has_role('admin')));
create policy "members: admin update" on public.members
  for update to authenticated
  using ((select public.has_role('admin')))
  with check ((select public.has_role('admin')));

create policy "invitations: admin full access" on public.invitations
  for all to authenticated
  using ((select public.has_role('admin')))
  with check ((select public.has_role('admin')));

create policy "instance_settings: members read" on public.instance_settings
  for select to authenticated using ((select public.has_role('reader')));
create policy "instance_settings: admin update" on public.instance_settings
  for update to authenticated
  using ((select public.has_role('admin')))
  with check ((select public.has_role('admin')));

-- Privilegi ------------------------------------------------------------------------
-- Oltre alla RLS: anon non tocca nulla, e dei membri si cambiano solo alcune colonne.

revoke all on public.books, public.collections, public.collection_books, public.loans,
  public.members, public.invitations, public.instance_settings from anon;
revoke insert, update, delete on public.members from authenticated;
grant update (display_name, role, active) on public.members to authenticated;
revoke insert, delete on public.instance_settings from authenticated;
revoke update on public.instance_settings from authenticated;
grant update (open_signup, signup_role, updated_by) on public.instance_settings to authenticated;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.handle_user_email_change() from public, anon, authenticated;
revoke execute on function public.member_role() from public, anon;
revoke execute on function public.has_role(public.app_role) from public, anon;
grant execute on function public.member_role() to authenticated;
grant execute on function public.has_role(public.app_role) to authenticated;
grant execute on function public.signup_mode() to anon, authenticated;

-- Copertine (Storage) --------------------------------------------------------------
-- Percorso dei file: <book id>.<ext>. I file salvati prima in <user id>/ restano leggibili.

drop policy "covers: owner read" on storage.objects;
drop policy "covers: owner insert" on storage.objects;
drop policy "covers: owner update" on storage.objects;
drop policy "covers: owner delete" on storage.objects;

create policy "covers: members read" on storage.objects
  for select to authenticated
  using (bucket_id = 'covers' and (select public.has_role('reader')));

create policy "covers: librarians insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'covers' and (select public.has_role('librarian')));

create policy "covers: librarians update" on storage.objects
  for update to authenticated
  using (bucket_id = 'covers' and (select public.has_role('librarian')));

create policy "covers: librarians delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'covers' and (select public.has_role('librarian')));
