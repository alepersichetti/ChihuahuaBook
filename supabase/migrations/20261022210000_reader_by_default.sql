-- Chi entra è sempre Lettore.
-- Il primo utente resta amministratore; tutti gli altri, invitati o registrati
-- con la registrazione aperta, partono come lettori. Bibliotecario e
-- amministratore si diventano solo per promozione, da Impostazioni → Utenti e ruoli.
-- Visto che un invito non dà più un ruolo, possono invitare anche i bibliotecari.

alter table public.invitations drop column role;
alter table public.instance_settings drop column signup_role;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  settings public.instance_settings;
  invited boolean;
  assigned public.app_role;
begin
  -- Il lock serializza le registrazioni: due "primi utenti" non possono diventare entrambi admin.
  select * into settings from public.instance_settings where id for update;

  invited := exists (
    select 1 from public.invitations i
    where i.email = lower(new.email) and i.expires_at > now()
  );

  assigned := case
    when not exists (select 1 from public.members) then 'admin'
    when invited or settings.open_signup then 'reader'
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

revoke execute on function public.handle_new_user() from public, anon, authenticated;

drop policy "invitations: admin full access" on public.invitations;
create policy "invitations: librarians full access" on public.invitations
  for all to authenticated
  using ((select public.has_role('librarian')))
  with check ((select public.has_role('librarian')));
