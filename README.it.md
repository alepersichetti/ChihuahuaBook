<p align="center">
  <img src="logo/chihuahua.svg" alt="ChihuahuaBook" width="200">
</p>

<p align="center"><a href="README.md">English</a> · <b>Italiano</b></p>

# ChihuahuaBook

Web app personale e open source per catalogare la propria libreria, pensata come sostituto di Bookpedia, con import diretto dei file `.pedia`.

Stack previsto: Next.js (App Router), Supabase, Vercel. Requisiti e architettura in definizione.

Per farla girare sul tuo computer (Node, Supabase locale, migrazioni, test) segui la guida [docs/local-development.it.md](docs/local-development.it.md).

## Documentazione

- [Sviluppo in locale](docs/local-development.it.md)
- [Accesso, ruoli e sicurezza](docs/authentication.it.md)
- [Import dei file .pedia di Bookpedia](docs/import-pedia.it.md)
- [Aggiungere un libro (manuale, Google Books, Open Library)](docs/adding-books.it.md)
- [Logo e favicon](logo/README.it.md)

Ogni documento esiste in due lingue: `nome.md` in inglese e `nome.it.md` in italiano. Se ne modifichi uno, aggiorna anche l'altro.

## Sviluppo

```bash
npm install
npm run dev
```

## Logo e favicon

Logo e favicon si configurano in `branding.json`, nella radice del progetto:

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

- `logo` è l'immagine in alto a sinistra nell'app; `name` il titolo della pagina e il testo accanto al logo.
- `android` finisce nel web manifest, per l'icona sulla schermata home.
- Le voci di `favicon` sono tutte facoltative: si mettono solo quelle che servono.
- I percorsi partono da `public/` (il file `public/brand/favicon.ico` si scrive `/brand/favicon.ico`); vanno bene anche URL completi.
- Per cambiare favicon basta copiare il nuovo file in `public/` e aggiornare il percorso. La configurazione è letta in fase di build: in sviluppo il cambio è immediato, in produzione serve un nuovo deploy. Se il JSON non è valido la build si ferma con un errore.

## Backend (Supabase)

Lo schema del database è in `supabase/migrations/`: libri, collezioni, prestiti, membri con i loro ruoli e il bucket `covers` per le copertine. La biblioteca è condivisa da tutta l'istanza: la Row Level Security fa leggere i lettori, modificare i bibliotecari e gestire gli utenti agli amministratori. Vedi [Accesso, ruoli e sicurezza](docs/authentication.it.md).

Per applicarlo a un progetto Supabase:

```bash
npx supabase login
npx supabase link --project-ref <project-ref>
npx supabase db push
```

Variabili d'ambiente (vedi `.env.example`): `SUPABASE_URL` e `SUPABASE_PUBLISHABLE_KEY`, anche con prefisso `NEXT_PUBLIC_`. È accettata anche `NEXT_PUBLIC_SUPABASE_ANON_KEY`, che è quella impostata dall'integrazione Supabase di Vercel.

Dopo una nuova migrazione, rigenera i tipi con `npm run db:types`.

### Architettura

Il backend vive in `src/server` ed è scritto in stile funzionale: niente classi né eccezioni, errori come valori (`Result` di `neverthrow`), dipendenze passate come funzioni. Non dipende da Vercel né da Next: gira su qualsiasi runtime con le Web API standard (`Request`/`Response`).

```
src/server/
  core/        dominio puro: tipi, validazione (zod), casi d'uso, porte. Solo zod e neverthrow.
  adapters/    implementazioni delle porte: Supabase (libri, sessione) e Open Library.
  http/        router e rotte su Request/Response standard.
  config/      lettura delle variabili d'ambiente.
  app/         composizione: collega adattatori, casi d'uso e rotte → (Request) => Promise<Response>.
  platform/    unico codice legato a Next: refresh della sessione nel proxy.
```

I confini sono controllati da ESLint (`eslint-plugin-boundaries`): il nucleo non può importare adattatori, HTTP o Next, e Next compare solo in `platform/` e `src/app/`.

In Next tutta l'API passa da `src/app/api/[...path]/route.ts`, che inoltra la richiesta a `appFromEnv(process.env)`. Per usare il backend su un altro runtime basta passare lo stesso handler al server (es. `Deno.serve(appFromEnv(Deno.env.toObject()))` o `export default { fetch: app }` su Workers).

### API

Tutte le rotte richiedono un membro attivo (cookie di sessione o `Authorization: Bearer <jwt>`) e un ruolo minimo: `401` senza sessione, `403` se il ruolo non basta. Le chiamate che modificano dati con il cookie di sessione devono arrivare dalla stessa origine.

| Metodo | Percorso | |
| --- | --- | --- |
| GET | `/api/books?q=&status=&tag=&favorite=&collection=&sort=&order=&limit=&offset=` | elenco con ricerca e filtri |
| POST | `/api/books` | crea un libro |
| GET / PATCH / DELETE | `/api/books/:id` | legge, modifica, elimina |
| GET | `/api/isbn/:isbn` | bozza da Open Library e copie già in catalogo |
| POST | `/api/import/books` | importa un lotto di libri (bibliotecario) |
| PUT | `/api/books/:id/cover` | carica una copertina (bibliotecario) |
| GET | `/api/me` | utente corrente e ruolo |
| GET / PATCH | `/api/admin/members`, `/api/admin/members/:id` | membri, ruolo e stato (amministratore) |
| GET / POST / DELETE | `/api/admin/invitations`, `/api/admin/invitations/:email` | inviti (amministratore) |
| GET / PATCH | `/api/admin/settings` | impostazioni dell'istanza (amministratore) |

Le rotte di lettura chiedono un lettore, quelle che modificano i libri un bibliotecario.

### Test

```bash
npm test
```
