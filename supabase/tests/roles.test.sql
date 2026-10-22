-- Verifica i ruoli e la RLS su un database con le migrazioni applicate.
-- Ogni controllo che fallisce interrompe lo script con un errore.
-- Uso: psql -v ON_ERROR_STOP=1 -f supabase/tests/roles.test.sql  (su un database di prova)

begin;

create function pg_temp.as_user(email text) returns void language sql security definer as $$
  select set_config('request.jwt.claim.sub', (select id::text from auth.users u where lower(u.email) = $1), true);
$$;

create function pg_temp.expect(ok boolean, label text) returns void language plpgsql as $$
begin
  if not coalesce(ok, false) then raise exception 'FALLITO: %', label; end if;
  raise notice 'ok: %', label;
end;
$$;

create function pg_temp.fails(statement text) returns boolean language plpgsql as $$
begin
  execute statement;
  return false;
exception when others then
  return true;
end;
$$;

grant execute on all functions in schema pg_temp to authenticated, anon;

-- Registrazione
select pg_temp.expect(public.signup_mode() = 'first_admin', 'istanza vuota: primo utente admin');
insert into auth.users (email) values ('Admin@Example.com');
select pg_temp.expect((select role from public.members where email = 'admin@example.com') = 'admin', 'il primo utente è admin');
select pg_temp.expect(public.signup_mode() = 'invite_only', 'poi serve un invito');
select pg_temp.expect(pg_temp.fails($$insert into auth.users (email) values ('stranger@example.com')$$), 'senza invito la registrazione fallisce');

insert into public.invitations (email, role) values ('lib@example.com', 'librarian'), ('reader@example.com', 'reader');
insert into auth.users (email) values ('lib@example.com'), ('reader@example.com');
select pg_temp.expect((select role from public.members where email = 'lib@example.com') = 'librarian', 'l''invito assegna il ruolo');
select pg_temp.expect(not exists (select 1 from public.invitations), 'l''invito usato sparisce');

insert into public.invitations (email, role, expires_at) values ('late@example.com', 'reader', now() - interval '1 day');
select pg_temp.expect(pg_temp.fails($$insert into auth.users (email) values ('late@example.com')$$), 'l''invito scaduto non vale');

update public.instance_settings set open_signup = true;
insert into auth.users (email) values ('open@example.com');
select pg_temp.expect((select role from public.members where email = 'open@example.com') = 'reader', 'registrazione aperta: lettore');
update public.instance_settings set open_signup = false;

-- Bibliotecario
set local role authenticated;
select pg_temp.as_user('lib@example.com');
insert into public.books (title) values ('Il nome della rosa');
select pg_temp.expect((select created_by from public.books) = auth.uid(), 'created_by lo imposta il database');
update public.books set rating = 5;
insert into public.collections (name) values ('Romanzi');
insert into public.collection_books (collection_id, book_id) select c.id, b.id from public.collections c, public.books b;
insert into public.loans (book_id, borrower) select id, 'Marta' from public.books;
select pg_temp.expect(pg_temp.fails($$update public.members set role = 'admin' where email = 'lib@example.com'$$)
  or not exists (select 1 from public.members where role = 'admin' and email = 'lib@example.com'), 'il bibliotecario non si promuove');
select pg_temp.expect((select count(*) from public.members) = 1, 'il bibliotecario vede solo sé stesso tra i membri');
select pg_temp.expect(pg_temp.fails($$insert into public.invitations (email) values ('x@example.com')$$), 'il bibliotecario non invita');

-- Lettore
select pg_temp.as_user('reader@example.com');
select pg_temp.expect((select count(*) from public.books) = 1, 'il lettore vede i libri di tutti');
select pg_temp.expect(pg_temp.fails($$insert into public.books (title) values ('x')$$), 'il lettore non inserisce');
update public.books set rating = 1;
select pg_temp.expect((select rating from public.books) = 5, 'il lettore non modifica');
delete from public.books;
select pg_temp.expect((select count(*) from public.books) = 1, 'il lettore non cancella');
delete from public.loans;
select pg_temp.expect((select count(*) from public.loans) = 1, 'il lettore non chiude prestiti');
select pg_temp.expect(pg_temp.fails($$update public.instance_settings set open_signup = true$$)
  or not (select open_signup from public.instance_settings), 'il lettore non cambia le impostazioni');
update public.instance_settings set language = 'en';
select pg_temp.expect((select language from public.instance_settings) = 'it', 'il lettore non cambia la lingua');
select pg_temp.expect(pg_temp.fails($$insert into storage.objects (bucket_id, name) values ('covers', 'a.jpg')$$), 'il lettore non carica copertine');

-- Admin
select pg_temp.as_user('admin@example.com');
select pg_temp.expect((select count(*) from public.members) = 4, 'l''admin vede tutti i membri');
update public.members set role = 'librarian' where email = 'reader@example.com';
select pg_temp.expect((select role from public.members where email = 'reader@example.com') = 'librarian', 'l''admin cambia i ruoli');
select pg_temp.expect(pg_temp.fails($$update public.members set role = 'reader' where email = 'admin@example.com'$$), 'l''ultimo admin non si declassa');
select pg_temp.expect(pg_temp.fails($$update public.members set email = 'x@y.z' where email = 'open@example.com'$$), 'l''email del membro non si modifica');
update public.instance_settings set open_signup = true, language = 'en';
select pg_temp.expect((select open_signup from public.instance_settings), 'l''admin cambia le impostazioni');
select pg_temp.expect(pg_temp.fails($$update public.instance_settings set language = 'fr'$$), 'solo lingue previste');
insert into storage.objects (bucket_id, name) values ('covers', 'b.jpg');

-- Membro disattivato
update public.members set active = false where email = 'lib@example.com';
select pg_temp.as_user('lib@example.com');
select pg_temp.expect((select count(*) from public.books) = 0, 'il membro disattivato non vede nulla');

-- Anonimo
reset role;
set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select pg_temp.expect(pg_temp.fails($$select * from public.books$$), 'anon non legge il catalogo');
select pg_temp.expect(public.signup_mode() = 'open', 'anon vede solo la modalità di registrazione');
select pg_temp.expect(public.instance_language() = 'en', 'anon legge la lingua dell''istanza');

rollback;
