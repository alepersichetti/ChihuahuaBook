<p align="center">
  <img src="logo/chihuahua.svg" alt="ChihuahuaBook" width="200">
</p>

<p align="center"><b>English</b> · <a href="README.it.md">Italiano</a></p>

# ChihuahuaBook

A personal, open source web app for cataloguing your own library, designed as a replacement for Bookpedia, with direct import of `.pedia` files.

Planned stack: Next.js (App Router), Supabase, Vercel. Requirements and architecture are still being defined.

To run it on your computer (Node, local Supabase, migrations, tests) follow the [docs/local-development.md](docs/local-development.md) guide.

## Documentation

- [Local development](docs/local-development.md)
- [Sign-in, roles and security](docs/authentication.md)
- [Importing Bookpedia .pedia files](docs/import-pedia.md)
- [Adding a book (manual, Google Books, Open Library)](docs/adding-books.md)
- [Logo and favicon](logo/README.md)

Every document exists in two languages: `name.md` in English and `name.it.md` in Italian. If you change one, update the other too.

## Development

```bash
npm install
npm run dev
```

## Logo and favicon

The logo and favicon are configured in `branding.json`, at the project root:

```json
{
  "name": "ChihuahuaBook",
  "logo": "/brand/chihuahua.svg",
  "favicon": {
    "svg": "/brand/chihuahua.svg",
    "png": "/brand/favicon-32.png",
    "ico": "/brand/favicon.ico",
    "appleTouchIcon": "/brand/apple-touch-icon.png",
    "android": [
      { "src": "/brand/icon-192.png", "sizes": "192x192" },
      { "src": "/brand/icon-512.png", "sizes": "512x512" }
    ]
  }
}
```

- `logo` is the image at the top left of the app; `name` is the page title and the text next to the logo.
- `android` goes into the web manifest, for the home screen icon.
- All `favicon` entries are optional: include only the ones you need.
- Paths start from `public/` (the file `public/brand/favicon.ico` is written `/brand/favicon.ico`); full URLs work too.
- To change the favicon, copy the new file into `public/` and update the path. The configuration is read at build time: in development the change is immediate, in production it needs a new deploy. If the JSON is invalid the build stops with an error.

## Backend (Supabase)

The database schema lives in `supabase/migrations/`: books, collections, loans, members with their roles, and the `covers` bucket for cover images. The library is shared by the whole instance: Row Level Security lets readers read, librarians edit and administrators manage users. See [Sign-in, roles and security](docs/authentication.md).

To apply it to a Supabase project:

```bash
npx supabase login
npx supabase link --project-ref <project-ref>
npx supabase db push
```

Environment variables (see `.env.example`): `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`, also with the `NEXT_PUBLIC_` prefix. `NEXT_PUBLIC_SUPABASE_ANON_KEY` is accepted as well, since that is the one set by Vercel's Supabase integration.

After a new migration, regenerate the types with `npm run db:types`.

### Architecture

The backend lives in `src/server` and is written in a functional style: no classes or exceptions, errors as values (`neverthrow`'s `Result`), dependencies passed in as functions. It depends on neither Vercel nor Next: it runs on any runtime with the standard Web APIs (`Request`/`Response`).

```
src/server/
  core/        pure domain: types, validation (zod), use cases, ports. Only zod and neverthrow.
  adapters/    port implementations: Supabase (books, session) and Open Library.
  http/        router and routes on standard Request/Response.
  config/      reading environment variables.
  app/         composition: wires adapters, use cases and routes → (Request) => Promise<Response>.
  platform/    the only Next-specific code: session refresh in the proxy.
```

Boundaries are enforced by ESLint (`eslint-plugin-boundaries`): the core cannot import adapters, HTTP or Next, and Next only appears in `platform/` and `src/app/`.

In Next the whole API goes through `src/app/api/[...path]/route.ts`, which forwards the request to `appFromEnv(process.env)`. To use the backend on another runtime, pass the same handler to its server (e.g. `Deno.serve(appFromEnv(Deno.env.toObject()))` or `export default { fetch: app }` on Workers).

### API

Every route requires an active member (session cookie or `Authorization: Bearer <jwt>`) and a minimum role: `401` without a session, `403` if the role isn't enough. Calls that change data with the session cookie must come from the same origin.

| Method | Path | |
| --- | --- | --- |
| GET | `/api/books?q=&status=&tag=&favorite=&collection=&sort=&order=&limit=&offset=` | list with search and filters |
| POST | `/api/books` | create a book |
| GET / PATCH / DELETE | `/api/books/:id` | read, update, delete |
| GET | `/api/isbn/:isbn` | draft from Open Library and copies already in the catalogue |
| POST | `/api/import/books` | import a batch of books (librarian) |
| PUT | `/api/books/:id/cover` | upload a cover (librarian) |
| GET | `/api/me` | current user and role |
| GET / PATCH | `/api/admin/members`, `/api/admin/members/:id` | members, role and active state (administrator) |
| GET / POST / DELETE | `/api/admin/invitations`, `/api/admin/invitations/:email` | invitations (administrator) |
| GET / PATCH | `/api/admin/settings` | instance settings (administrator) |

Reading routes need a reader, the ones that change books a librarian.

### Tests

```bash
npm test
```
