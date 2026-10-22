# Running ChihuahuaBook locally

**English** · [Italiano](local-development.it.md)

This guide takes you from nothing to a working app on your own computer: the Next.js interface on `http://localhost:3000` and, if needed, a full Supabase (Postgres, Auth, Storage) in Docker with the catalogue schema already applied.

There are two levels, and the first needs nothing but Node:

1. **Interface only**: the library with sample data. Node and npm are enough.
2. **Interface + backend**: the `/api/...` APIs on a local Supabase. You also need Docker and the Supabase CLI.

> The parts about Supabase, the API and migrations apply once the backend (PR #2) is in `main`.

## Prerequisites

| Tool | Version | Used for |
| --- | --- | --- |
| [Node.js](https://nodejs.org/) | 22 LTS (at least 20.9, required by Next 16) | dev server, build, tests |
| npm | the one bundled with Node | dependencies (the repo has `package-lock.json`) |
| Git | any recent version | cloning the repo |
| Docker | Docker Desktop, OrbStack, Colima or Podman | local Supabase only |

The Supabase CLI does not need a separate install: use it with `npx supabase ...`, which downloads it on first use. If you'd rather have it installed, on macOS `brew install supabase/tap/supabase` works too (then drop `npx` from the commands below).

For local Supabase, plan on a few GB of free disk space: the first run downloads about ten Docker images.

## 1. Clone and install

```bash
git clone https://github.com/alepersichetti/ChihuahuaBook.git
cd ChihuahuaBook
npm ci
```

`npm ci` installs exactly the versions in the lockfile. Use `npm install` only when adding or updating a dependency.

## 2. Interface only

```bash
npm run dev
```

Open <http://localhost:3000>. The library shows the sample data from `src/features/library/sample-library.ts` and works without any environment variables. File changes show up immediately (hot reload).

Without Supabase configuration the page works, while the APIs answer `500 misconfigured`: that's expected, see the next step.

## 3. Local Supabase

### Starting it

With Docker running, from the project folder:

```bash
npx supabase start
```

The first time it takes a few minutes to download the images; after that, a few seconds. The command:

- starts Postgres, Auth, Storage, REST, Studio and a fake mail server, using the configuration in `supabase/config.toml`;
- applies all the migrations in `supabase/migrations/` in order (tables `books`, `collections`, `collection_books`, `loans`, RLS and the `covers` bucket).

At the end it prints the URLs and keys. To see them again at any time:

```bash
npx supabase status
```

Useful URLs (default ports):

| Service | URL |
| --- | --- |
| Supabase API | <http://127.0.0.1:54321> |
| Studio (database web UI) | <http://127.0.0.1:54323> |
| Mailpit (confirmation and reset emails) | <http://127.0.0.1:54324> |
| Direct Postgres | `postgresql://postgres:postgres@127.0.0.1:54322/postgres` |

### Environment variables

Copy the example and fill it in with the values from `npx supabase status`:

```bash
cp .env.example .env.local
```

```dotenv
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...   # "Publishable key" from supabase status
```

Instead of the publishable key, the older `NEXT_PUBLIC_SUPABASE_ANON_KEY` (the "anon key") works too: the backend accepts both, with or without the `NEXT_PUBLIC_` prefix. `.env.local` is ignored by Git, so the keys don't end up in the repo.

Restart `npm run dev` after changing `.env.local`: Next reads the variables only at startup.

### Checking that the backend responds

```bash
curl -i http://localhost:3000/api/books
```

The expected response is `401 {"error":"unauthenticated"}`: the backend is configured and wants a user. There is no sign-in UI yet, so to try the APIs with a real user:

1. Create a user from Studio (<http://127.0.0.1:54323> → Authentication → Add user) or from the terminal. Locally, emails don't need confirming.

   ```bash
   KEY=sb_publishable_...   # the same key as in .env.local

   curl -s http://127.0.0.1:54321/auth/v1/signup \
     -H "apikey: $KEY" -H "Content-Type: application/json" \
     -d '{"email":"me@example.com","password":"password123"}'
   ```

2. Sign in and grab the token:

   ```bash
   TOKEN=$(curl -s "http://127.0.0.1:54321/auth/v1/token?grant_type=password" \
     -H "apikey: $KEY" -H "Content-Type: application/json" \
     -d '{"email":"me@example.com","password":"password123"}' \
     | node -pe 'JSON.parse(require("fs").readFileSync(0)).access_token')
   ```

3. Call the APIs with the token:

   ```bash
   # create a book
   curl -s http://localhost:3000/api/books \
     -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
     -d '{"title":"The Name of the Rose","authors":["Umberto Eco"]}'

   # list
   curl -s http://localhost:3000/api/books -H "Authorization: Bearer $TOKEN"

   # draft from Open Library from an ISBN
   curl -s http://localhost:3000/api/isbn/9788845292613 -H "Authorization: Bearer $TOKEN"
   ```

The full list of routes is in the [README](../README.md#api). Books you create are also visible in Studio, in the `books` table.

### Stopping and cleaning up

```bash
npx supabase stop               # stops the containers, data is kept
npx supabase stop --no-backup   # stops and deletes local data
npx supabase db reset           # recreates the database from scratch and reapplies all migrations
```

## 4. Working on the schema

```bash
npx supabase migration new change_name   # creates supabase/migrations/<timestamp>_change_name.sql
# write the SQL in the file, then:
npx supabase migration up                # applies new migrations to the local database
# or, to start clean:
npx supabase db reset
```

After a migration, regenerate the TypeScript types from the local database:

```bash
npx supabase gen types typescript --local --schema public > src/server/adapters/supabase/database.types.ts
```

(`npm run db:types` does the same, but from the remote Supabase project set in `SUPABASE_PROJECT_ID`.)

To push the migrations to a cloud Supabase project, see the "Backend (Supabase)" section of the [README](../README.md#backend-supabase).

## 5. Tests and checks

| Command | What it does |
| --- | --- |
| `npm test` | unit tests with Vitest (no Supabase or network needed) |
| `npm run test:watch` | same as above, rerun on every change |
| `npm run lint` | ESLint, including the boundaries between `core`, `adapters`, `http` and Next |
| `npm run typecheck` | type checking with `tsc` |
| `npm run build` | production build, as on Vercel |
| `npm start` | serves the build on <http://localhost:3000> |

`typecheck` needs Next to have generated its types (`LayoutProps` and the like): this happens on its own after `npm run dev` or `npm run build`. On a fresh clone run `npx next typegen` first, otherwise `tsc` reports `Cannot find name 'LayoutProps'`.

## Common problems

- **`Cannot connect to the Docker daemon`**: Docker isn't running. Open Docker Desktop (or `colima start`) and try again.
- **Port already in use** (3000 or 5432x): another process is using it. For Next use `npm run dev -- -p 3001`; for Supabase stop the other project with `npx supabase stop --project-id <name>` or change the ports in `supabase/config.toml`.
- **`toomanyrequests` or `rate limit` during `supabase start`**: Docker Hub limits anonymous downloads. Run `docker login` with a free account and try again.
- **`500 misconfigured` from the APIs**: `NEXT_PUBLIC_SUPABASE_URL` or the key is missing from `.env.local`, or you didn't restart `npm run dev` after adding them.
- **`401 unauthenticated`**: all good, you're just missing the token (see above).
- **Something doesn't compile after a `git pull`**: rerun `npm ci`; if new migrations arrived, `npx supabase migration up` (or `db reset`).
- **`AGENTS.md` shows up as modified after `npm run dev`**: Next 16 rewrites a block of that file on startup. If that's the only change, you can commit it or discard it.
