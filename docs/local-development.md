# Running ChihuahuaBook locally

**English** · [Italiano](local-development.it.md)

A step-by-step guide to running ChihuahuaBook on your own computer: the database (Supabase in Docker), the Next.js server and a checklist to verify that everything works, from the first administrator to importing a `.pedia` file.

There are two ways to run it:

| | What you get | What you need | Time |
| --- | --- | --- | --- |
| **A. Demo mode** | the interface with sample data and a demo administrator, nothing is saved | Node | 5 minutes |
| **B. Full stack** | real sign-in, roles, database, cover storage, import, online catalogues | Node + Docker | 15 minutes the first time |

## Quick start: everything with one command

With Docker running:

```bash
git clone https://github.com/alepersichetti/ChihuahuaBook.git
cd ChihuahuaBook
npm ci
npm run dev:all
```

Open <http://127.0.0.1:3000> and go to the [verification checklist](#5-verification-checklist). `Ctrl+C` stops everything.

`npm run dev:all` (`scripts/dev.mjs`) does in order what steps 3 and 4 below explain by hand:

1. checks that Docker responds;
2. starts the local Supabase (`npx supabase start`, skipping the services the app doesn't use), which the first time downloads the Docker images;
3. applies any new migrations (`npx supabase migration up --local`);
4. reads URL and key from `npx supabase status` and, if `.env.local` doesn't exist, creates it;
5. starts `next dev` on `127.0.0.1:3000` and prints the addresses of the app, Studio, Mailpit and Postgres;
6. on `Ctrl+C` stops the server and then Supabase (`npx supabase stop`: the data is kept).

Options:

```bash
npm run dev:all -- --keep-db   # leave Supabase running on exit: the next start is immediate
npm run dev:all -- -p 3001     # any other argument goes to next dev
```

`dev:all` always uses the local database: the URL and key from `supabase status` take precedence over those in `.env.local`, while the other variables in `.env.local` (such as `GOOGLE_BOOKS_API_KEY`) still apply. It works the same on macOS, Linux and Windows.

The rest of the guide explains each step one by one, for when you want to run them separately or something goes wrong. Do steps 1 and 2 for demo mode; 1 and 3–6 for the full stack.

## 0. Prerequisites

| Tool | Version | Used for |
| --- | --- | --- |
| [Node.js](https://nodejs.org/) | 22 LTS (at least 20.9, required by Next 16) | server, build, tests |
| npm | the one bundled with Node | dependencies (the repo has `package-lock.json`) |
| Git | any recent version | cloning the repo |
| Docker | Docker Desktop, OrbStack, Colima or Podman | the local database only |
| `psql` (optional) | any | running the database tests from the terminal |

The Supabase CLI needs no separate install: use it as `npx supabase ...`, which downloads it on first use. If you'd rather have it installed, on macOS `brew install supabase/tap/supabase` works too (then drop `npx` from the commands below).

Plan on a few GB of free disk space: the first database start downloads about ten Docker images.

## 1. Clone and install

```bash
git clone https://github.com/alepersichetti/ChihuahuaBook.git
cd ChihuahuaBook
npm ci
```

`npm ci` installs exactly the versions in the lockfile. Use `npm install` only when adding or updating a dependency.

> Don't run `npm audit fix --force`. `npm audit` reports a few vulnerabilities in the development tools (ESLint and its plugins, never shipped to the browser or the server: `npm audit --omit=dev` finds none). `--force` "fixes" them by downgrading `eslint-config-next` to version 14, which isn't compatible with Next 16 and breaks both `npm ci` and `npm run lint`.

## 2. Demo mode (no database)

```bash
npm run dev
```

Open <http://localhost:3000>. You're signed in as a demo administrator and the library shows the sample books from `src/features/library/sample-library.ts`. Nothing is saved: a reload brings everything back.

To see the app as another role or in English:

```bash
DEMO_ROLE=reader npm run dev       # reader | librarian | admin
DEMO_LANGUAGE=en npm run dev       # it | en
```

In demo mode the APIs answer `500 misconfigured` because there's no database: that's expected. The demo user only exists in `npm run dev`; a production build without configuration answers `503` on every page.

Stop the server with `Ctrl+C`.

## 3. The database

The database is a full Supabase (Postgres, Auth, Storage, REST API, Studio and a fake mail server) running in Docker, configured by `supabase/config.toml`.

### 3.1 Start it

With Docker running, from the project folder:

```bash
npx supabase start
```

The first time it takes a few minutes to download the images; after that, a few seconds. At the end it prints URLs and keys. To see them again:

```bash
npx supabase status
```

| Service | URL |
| --- | --- |
| Supabase API | <http://127.0.0.1:54321> |
| Studio (database web UI) | <http://127.0.0.1:54323> |
| Mailpit (every email the app sends) | <http://127.0.0.1:54324> |
| Direct Postgres | `postgresql://postgres:postgres@127.0.0.1:54322/postgres` |

### 3.2 What's inside

On startup the CLI applies the migrations in `supabase/migrations/`, in name order:

| Migration | What it creates |
| --- | --- |
| `20261022140000_catalog.sql` | tables `books`, `collections`, `collection_books`, `loans`; full-text search; the private `covers` bucket (JPEG, PNG and WebP, at most 5 MB) |
| `20261022160000_roles.sql` | `members` (role and active state of each user), `invitations`, `instance_settings` (language, sign-up mode); the sign-up trigger that makes the first user administrator; RLS policies by role on tables and covers |
| `20261022180000_import_hash.sql` | the `import_hash` column, which lets a `.pedia` re-import know which books changed |
| `20261022210000_reader_by_default.sql` | everyone who joins (by invitation or open sign-up) starts as reader: removes the role from invitations and open sign-up |

To check they were all applied:

```bash
npx supabase migration list --local
```

### 3.3 Look at it in Studio

Open <http://127.0.0.1:54323>:

- **Table Editor**: the `public` tables. On a fresh database they're empty, except `instance_settings`, which has one row (language `it`, sign-up by invitation).
- **Authentication → Users**: the accounts. Empty until the first sign-up.
- **Storage → covers**: the cover images, in `covers/<user id>/<book id>.<ext>`.
- **SQL Editor**: queries on the database.

Studio connects as an administrator and **ignores RLS**: it shows every row whatever the role. To see what a user sees, use the queries in 3.4.

### 3.4 Verify the security rules (RLS)

The automatic tests in `supabase/tests/roles.test.sql` check 30 rules (first administrator, invitations, what each role can read and write, covers, the last administrator who can't be removed, anonymous visitors). They need an **empty** database and roll back everything at the end:

```bash
npx supabase db reset
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -v ON_ERROR_STOP=1 -f supabase/tests/roles.test.sql
```

Each check prints `NOTICE: ok: ...`; the first one that fails stops the script with `FALLITO: ...` ("failed").

Without `psql` installed, open the file, copy it into Studio's SQL Editor and run it.

To try a rule by hand once there are users (after step 5), from the SQL Editor:

```sql
begin;
-- impersonate a user (set the id before switching role)
select set_config('request.jwt.claim.sub',
  (select user_id::text from public.members where email = 'reader@example.com'), true);
set local role authenticated;

select public.member_role();                       -- reader
select count(*) from public.books;                 -- reading works
insert into public.books (title) values ('Test');  -- error: violates row-level security policy
rollback;
```

With a librarian's or administrator's email the same `insert` succeeds (and `rollback` undoes it).

### 3.5 Reset, sample data, stop

```bash
npx supabase db reset           # wipes the database and reapplies every migration (and supabase/seed.sql, if present)
npx supabase stop               # stops the containers, data is kept
npx supabase stop --no-backup   # stops them and deletes the data
```

There's no `supabase/seed.sql` in the repo: books are created by the app's users (step 5), and the first user must sign up through the app to become administrator. If you want test books after every reset, create `supabase/seed.sql` with `insert into public.books (title, authors) values (...)`. Git doesn't ignore it, so keep personal data out of it.

After `db reset` the users are gone too: start again from 5.1.

### 3.6 Change the schema

```bash
npx supabase migration new change_name   # creates supabase/migrations/<timestamp>_change_name.sql
# write the SQL in the file, then:
npx supabase migration up                # applies the new migrations to the local database
```

Then regenerate the TypeScript types from the local database:

```bash
npx supabase gen types typescript --local --schema public > src/server/adapters/supabase/database.types.ts
```

(`npm run db:types` does the same from the remote project set in `SUPABASE_PROJECT_ID`.) To push migrations to a cloud project, see the "Backend (Supabase)" section of the [README](../README.md#backend-supabase).

## 4. Configure and start the server

### 4.1 Environment variables

```bash
cp .env.example .env.local
```

Fill in `.env.local` with the values from `npx supabase status`:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...   # "Publishable key"

# Optional: your own Google Books API key (Google Cloud console → APIs → Books API).
# Without it Google Books works on a shared daily quota that runs out quickly.
GOOGLE_BOOKS_API_KEY=
```

Instead of the publishable key, the older "anon key" in `NEXT_PUBLIC_SUPABASE_ANON_KEY` works too. `SUPABASE_PROJECT_ID` is only needed for `npm run db:types`. `.env.local` is ignored by Git.

### 4.2 Start

```bash
npm run dev
```

(`npm run dev:all` does 3.1, 4.1 and 4.2 in one go: see the [quick start](#quick-start-everything-with-one-command).)

Open **<http://127.0.0.1:3000>** (not `localhost`): the links in the confirmation emails point to `127.0.0.1:3000`, as set in `supabase/config.toml`, and the browser keeps the session separately for the two names.

Next reads `.env.local` only at startup: restart the server after changing it.

### 4.3 Quick check

```bash
curl -i http://127.0.0.1:3000/api/books
```

`401 {"error":"unauthenticated"}` means the server reaches the database and wants a user. `500 misconfigured` means `.env.local` is missing or the server wasn't restarted.

## 5. Verification checklist

Go through it in order on a fresh database (`npx supabase db reset`). Every email ends up in Mailpit, <http://127.0.0.1:54324>. Passwords need at least 10 characters, with letters and digits.

To keep several users signed in at once, use different browsers or private windows.

### 5.1 First administrator

- [ ] <http://127.0.0.1:3000> sends you to the sign-in page, which says the instance is new and the first account becomes administrator.
- [ ] Sign up with an email (e.g. `admin@example.com`). The page asks you to confirm the email.
- [ ] In Mailpit open the email and click the link: you land in the library, empty.
- [ ] In Studio, `members` has your row with `role = admin`.
- [ ] Back on the sign-in page (sign out from the account menu, top right), the hint now says sign-up is by invitation.

### 5.2 Invitations and roles

In **Settings** (bottom left) → **Users and roles**:

- [ ] Invite `lib@example.com` and `reader@example.com`. They appear under Invitations as Reader, with their expiry date (14 days).
- [ ] In another browser, sign up as `stranger@example.com`, who wasn't invited: sign-up is refused.
- [ ] Sign up as `lib@example.com` and confirm from Mailpit: they get in as reader. The invitation disappears from the list.
- [ ] Do the same for `reader@example.com`.
- [ ] As administrator, pick **Librarian** in the selector for `lib@example.com`: the count at the top updates. Then pick **Administrator**: a confirmation appears; press **Cancel**.
- [ ] As the reader: no **Add** button, no editing controls, Settings can't be opened.
- [ ] As the librarian: Add and Import `.pedia` are there; in Settings only Appearance and About, no Language or Users and roles.
- [ ] As administrator, try demoting yourself: the interface doesn't allow it. Deactivate the reader: after a reload they see an empty library.
- [ ] Reactivate the reader.

### 5.3 Adding books

As administrator or librarian, with the **Add** button:

- [ ] **Manual entry**: fill in at least the title and save. The book appears in the list and in Studio, table `books`.
- [ ] **Automatic fill → Google Books**: search for `eco nome della rosa`, press **Use** on a result: the form opens filled in, cover included. Save. Without `GOOGLE_BOOKS_API_KEY` Google refuses the search and the window says so.
- [ ] **Automatic fill → Open Library**: search by ISBN, e.g. `9788845292613`. If that ISBN is already in the library, the dialog warns you.
- [ ] The cover of the saved book is in Studio → Storage → `covers`.
- [ ] As the reader, the new books are visible but can't be edited.

### 5.4 Importing a `.pedia`

Use a Bookpedia export (the `.pedia` folder, a zip of it, or just its `Info.xml`). Details are in [import-pedia.md](import-pedia.md).

- [ ] **Import .pedia** (bottom left): drag in the file. The preview shows how many books it found and how many covers it matched.
- [ ] Import with **Add only what's new**. At the end the books are in the library, with covers.
- [ ] Import the same file again: nothing is duplicated (the books come out unchanged).
- [ ] Edit a book by hand and import again with **Add only what's new**: your edit stays.
- [ ] Import with **Replace the whole library**: the preview says how many books will be deleted (the ones added by hand in 5.3) and asks for confirmation. After the import only the books in the file are left.

### 5.5 Interface

- [ ] The three view buttons in the toolbar: **Table** (columns you can sort and choose), **Grid** (covers, size in Settings → Appearance), **Gallery** (scrolling covers).
- [ ] Settings → Appearance → **Color palette**: Light, Warm, Dark. The choice is per browser.
- [ ] As administrator, Settings → **Language** → English: the whole interface switches, for every user, sign-in page included. Switch back to Italian if you like.
- [ ] Account menu → **Change password**, then sign out and sign in with the new password.
- [ ] Sign-in page → **Forgot your password?**: the email arrives in Mailpit and the link lets you set a new password.

## 6. The APIs from the terminal

Every route needs an active user. To get a token for a user created in step 5:

```bash
KEY=sb_publishable_...   # the same key as in .env.local

TOKEN=$(curl -s "http://127.0.0.1:54321/auth/v1/token?grant_type=password" \
  -H "apikey: $KEY" -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"your-password"}' \
  | node -pe 'JSON.parse(require("fs").readFileSync(0)).access_token')

curl -s http://127.0.0.1:3000/api/me -H "Authorization: Bearer $TOKEN"            # user and role
curl -s http://127.0.0.1:3000/api/books -H "Authorization: Bearer $TOKEN"         # list
curl -s http://127.0.0.1:3000/api/books -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"The Name of the Rose","authors":["Umberto Eco"]}'                 # create
curl -s "http://127.0.0.1:3000/api/search?source=open_library&q=9788845292613&field=isbn" \
  -H "Authorization: Bearer $TOKEN"                                               # online catalogue
```

With the reader's token the `POST` answers `403`. The full list of routes is in the [README](../README.md#api).

## 7. Production build

To try the app as it runs on Vercel:

```bash
npm run build
npm start          # http://127.0.0.1:3000, reads .env.local
```

Without Supabase configuration a production build answers `503` on every page: there's no demo mode.

## 8. Automated checks

| Command | What it does |
| --- | --- |
| `npm run dev:all` | database and server together (see the [quick start](#quick-start-everything-with-one-command)) |
| `npm test` | unit tests with Vitest (no database or network needed) |
| `npm run test:watch` | same, rerun on every change |
| `npm run test:e2e` | end-to-end tests with Playwright against the local Supabase (see [step 9](#9-end-to-end-tests-playwright)) |
| `npm run lint` | ESLint, including the boundaries between `core`, `adapters`, `http` and Next |
| `npm run typecheck` | type checking with `tsc` |
| `npm run build` | production build |
| `psql ... -f supabase/tests/roles.test.sql` | the RLS tests (see 3.4) |

`typecheck` needs the types Next generates (`LayoutProps` and the like): they appear after `npm run dev` or `npm run build`. On a fresh clone run `npx next typegen` first, otherwise `tsc` reports `Cannot find name 'LayoutProps'`.

## 9. End-to-end tests (Playwright)

The tests in `e2e/` drive the app in a real browser (Chromium), the way a person would, against the local Supabase. They cover:

| File | What it tests |
| --- | --- |
| `auth.setup.ts` | the first user signs up, confirms the email from Mailpit and becomes administrator; librarian and reader sign in with their password; a wrong password doesn't get in |
| `add-book.spec.ts` | adding a book by hand, from Google Books and from Open Library (including a search with no results), checking what was saved in the database |
| `collections.spec.ts` | new collection, a book dragged onto a collection, a collection dragged into a folder and moved out from the menu, collections from the book details |
| `import.spec.ts` | importing a zipped `.pedia` with a cover; importing the same file again creates no duplicates |
| `roles.spec.ts` | what reader, librarian and administrator see (also when calling the API), promotion to librarian, confirmation for administrator, invitations, language |

### 9.1 Running them

With Docker running, the first time install Playwright's browser:

```bash
npx playwright install chromium     # on Linux: npx playwright install --with-deps chromium
npm run test:e2e
```

`npm run test:e2e` (`scripts/e2e.mjs`):

1. starts the local Supabase if it's stopped (like `dev:all`);
2. **resets the database** (`npx supabase db reset`), because the first registered user becomes administrator and the tests start from a fresh instance;
3. runs `playwright test`, which builds the app for production and serves it on <http://127.0.0.1:3100>, together with a fake server for Google Books and Open Library (`e2e/mock-sources.mjs`) on `127.0.0.1:4010`: the tests never use the real catalogues or a Google key;
4. at the end stops Supabase, if it started it.

The ports differ from `npm run dev:all`, so the tests run even with the development server up.

If the local database already has users, the script stops instead of deleting them. To reset it anyway:

```bash
npm run test:e2e -- --reset
```

Other arguments go to Playwright:

```bash
npm run test:e2e -- --ui                     # Playwright's UI, step by step
npm run test:e2e -- --headed                 # visible browser
npm run test:e2e -- e2e/import.spec.ts       # a single file (the user setup always runs first)
E2E_DEV=1 npm run test:e2e                   # next dev instead of the build: faster while writing tests
npx playwright show-report                   # HTML report of the last run
```

With Supabase already running and a freshly reset database you can also run `npx playwright test` directly: it reads URLs and keys from `npx supabase status`.

When a test fails, `test-results/` holds a screenshot and a trace (`npx playwright show-trace test-results/.../trace.zip`).

### 9.2 How they work

- The test users are in `e2e/support/users.ts`. The administrator goes through the real sign-up; the others are created with the local Supabase service key (`e2e/support/supabase.ts`), so no more emails are needed: the local Supabase sends at most 2 per hour.
- The sessions saved by the setup (`e2e/.auth/`, ignored by Git) are reused by the other tests with `test.use({ storageState })`.
- Tests run one at a time (`workers: 1`): they share the same database.
- For the app, the fake catalogues are just two environment variables: `GOOGLE_BOOKS_API_URL` and `OPEN_LIBRARY_URL` (never set in production).

### 9.3 In CI

`.github/workflows/ci.yml` runs on every push to `main` and on every pull request, with two jobs:

- **Lint, types, unit tests and build** (`Lint, tipi, test unitari e build`): `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`;
- **E2E tests** (`Test e2e (Playwright)`): installs Chromium and runs `npm run test:e2e` on the runner, where Supabase runs in Docker. The Playwright report (with traces of failed tests) stays among the run's artifacts for 14 days.

To block merging a pull request with failing tests, on GitHub: Settings → Branches → rule for `main` → "Require status checks to pass" with both jobs.

## Common problems

- **`npm ci` fails with `ERESOLVE` on `eslint-config-next`**: someone ran `npm audit fix --force` (see step 1). Put back `"eslint-config-next": "16.4.2"` and `"eslint-plugin-boundaries": "^7.2.1"` in `package.json` and run `npm install`.
- **`Cannot connect to the Docker daemon`**: Docker isn't running. Open Docker Desktop (or `colima start`) and try again.
- **`toomanyrequests` or `rate limit` during `supabase start`**: Docker Hub limits anonymous downloads. Run `docker login` with a free account and try again.
- **Port already in use** (3000 or 5432x): for Next use `npm run dev -- -p 3001` (and add that address to `additional_redirect_urls` in `supabase/config.toml`); for Supabase stop the other project with `npx supabase stop --project-id <name>`.
- **The confirmation link leads to an error or back to sign-in**: you opened the app on `localhost` instead of `127.0.0.1`, or the link has already been used. Sign up again from <http://127.0.0.1:3000>.
- **"Sign-up is by invitation" on a fresh database**: there's already a user. Check Studio → Authentication → Users, or start over with `npx supabase db reset`.
- **Locked out as administrator**: in Studio's SQL Editor, `update public.members set role = 'admin', active = true where email = 'you@example.com';`
- **`500 misconfigured` from the APIs**: `.env.local` is missing the URL or the key, or the server wasn't restarted.
- **Google Books returns no results or a quota error**: set `GOOGLE_BOOKS_API_KEY` in `.env.local` and restart, or use Open Library.
- **Something doesn't compile after a `git pull`**: run `npm ci` again; if new migrations arrived, `npx supabase migration up` (or `db reset`).
- **`npm run test:e2e` says the database already has data**: the tests reset it and the script won't do that without permission. Run `npm run test:e2e -- --reset` (you lose local users and books).
- **E2E tests fail with `Executable doesn't exist`**: Playwright's browser is missing, run `npx playwright install chromium`.
- **`AGENTS.md` appears after `npm run dev`**: Next 16 generates it on startup. It isn't part of the repo: delete it or leave it uncommitted.
