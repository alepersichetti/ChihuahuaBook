# Sign-in, roles and security

Each ChihuahuaBook instance has **one shared library**. Everyone who signs in sees the same books, collections and loans; what they can do depends on their role.

| Role | Can do |
| --- | --- |
| **Reader** | Browse the whole catalogue, read-only. No access to settings. |
| **Librarian** | Everything a reader can, plus add, edit and delete books, collections, loans and covers, and import `.pedia` files. |
| **Administrator** | Everything a librarian can, plus manage users (roles, invitations, deactivation) and instance settings, including the interface language. |

Roles are enforced in three places, so a bug in one layer doesn't open the data:

1. **Database (RLS)**: `supabase/migrations/20261022160000_roles.sql`. The `public.has_role()` function reads the role from `public.members` and every policy uses it. This is the real guarantee: it also holds for anyone calling Supabase directly with their own token.
2. **API**: every route in `src/server/http` declares the minimum role (`guarded("read" | "edit" | "administer")`) and answers `401` without a session, `403` with an insufficient role.
3. **Interface**: readers don't see editing controls; readers can't open Settings; only administrators see the **Users and access** section there.

## Settings and language

Readers can't open Settings. Librarians see their personal preferences (layout, cover size) and the About section. Administrators also see **Language** and **Users and access**.

The interface is available in Italian and English. The language is one for the whole instance (`instance_settings.language`, Italian by default): only an administrator can change it, and the sign-in page uses it too. The texts are in `src/features/i18n/messages/` (`it.ts` is the reference, `en.ts` must have the same keys, and TypeScript checks it).

## The first administrator

On a fresh instance **the first account that signs up becomes administrator**. The sign-in page says so ("this instance is new").

After that, sign-up is **by invitation**: in Settings → *Users and access* the administrator enters an email and a role, and only that email can create an account (the invitation lasts 14 days). The administrator can also open sign-up to everyone, with Reader or Librarian as the starting role.

Everything happens in a trigger on `auth.users` (`public.handle_new_user`), so no `service_role` key is needed in the app. A sign-up without invitation is rejected by the database and the page explains why.

> Create the administrator right after deploying, before sharing the address.

Other rules:

- An instance always has at least one active administrator: the database refuses to demote or deactivate the last one.
- Administrators can't demote or deactivate themselves from the interface (ask another administrator).
- A deactivated user can still sign in but sees nothing: RLS gives them no rows.
- To delete an account permanently, use the Supabase dashboard (Authentication → Users).

### If you lock yourself out

From the Supabase SQL editor:

```sql
update public.members set role = 'admin', active = true
where email = 'you@example.com';
```

## Supabase Auth setup

In the dashboard of the Supabase project (Authentication):

1. **URL Configuration**: *Site URL* = the app address (e.g. `https://books.example.com`). Add `https://books.example.com/auth/confirm` to *Redirect URLs*.
2. **Sign In / Providers → Email**: keep *Confirm email* on. Sign-up must stay enabled: invitations go through normal sign-up, and the database turns away anyone not invited.
3. **Passwords**: minimum length 10, with letters and digits (the same rules are in `supabase/config.toml` for the local stack). Turn on *leaked password protection* if your plan has it.
4. **Rate limits**: the defaults are fine; `config.toml` lowers sign-in/sign-up to 15 per 5 minutes per IP. Sign-in goes straight from the browser to Supabase Auth, so these limits are what protect against password guessing.
5. Optional: **Attack Protection → CAPTCHA** (Turnstile or hCaptcha) if the instance is public.
6. Without your own SMTP server Supabase sends very few emails per hour: set one up (Authentication → Emails → SMTP) before inviting people.

The links in the emails land on `/auth/confirm`, which works both with the default templates (PKCE `?code=`) and with templates using `{{ .TokenHash }}`.

## Other security measures

- **Protected pages**: the proxy (`src/proxy.ts`) refreshes the session and sends anyone without one to `/login`; pages check the role again on the server. In production, without Supabase configuration, pages answer `503` instead of opening up.
- **CSRF**: API calls that change data with the session cookie must come from the same origin (`Origin` or `Sec-Fetch-Site`), otherwise `403 cross_origin`. Sign-out is a `POST` with the same check.
- **Security headers** on every response (`src/config/security-headers.ts`): Content-Security-Policy, HSTS, `X-Frame-Options: DENY`, `nosniff`, Referrer-Policy, Permissions-Policy.
- **Safe redirects**: after sign-in the app only returns to internal paths (`?next=/…`), never to external addresses.
- **Generic errors**: the sign-in and password-recovery pages don't reveal whether an email is registered.

## Local development

Without Supabase, `npm run dev` still opens the interface on sample data with a demo user who is an administrator. To see it as another role:

```bash
DEMO_ROLE=reader DEMO_LANGUAGE=en npm run dev
```

The demo user exists only in `npm run dev`; a production build without configuration refuses every page.

With the local Supabase stack (`npx supabase start`) confirmation emails end up in Mailpit at <http://127.0.0.1:54324>.

The RLS tests are in `supabase/tests/roles.test.sql`: they run on a database with the migrations applied, inside a transaction they roll back.

```bash
npx supabase db reset
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -v ON_ERROR_STOP=1 -f supabase/tests/roles.test.sql
```

Run them on an empty database: the first check expects no users.
