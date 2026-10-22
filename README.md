# pedia-next

Web app personale e open source per catalogare la propria libreria, pensata come sostituto di Bookpedia, con import diretto dei file `.pedia`.

Stack previsto: Next.js (App Router), Supabase, Vercel. Requisiti e architettura in definizione.

## Sviluppo

```bash
npm install
npm run dev
```

## Backend (Supabase)

Lo schema del database è in `supabase/migrations/`: libri, collezioni, prestiti e il bucket `covers` per le copertine. Ogni tabella ha la Row Level Security attiva e ogni utente vede solo i propri dati.

Per applicarlo a un progetto Supabase:

```bash
npx supabase login
npx supabase link --project-ref <project-ref>
npx supabase db push
```

Variabili d'ambiente (vedi `.env.example`): `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. È accettata anche `NEXT_PUBLIC_SUPABASE_ANON_KEY`, che è quella impostata dall'integrazione Supabase di Vercel.

Dopo una nuova migrazione, rigenera i tipi con `npm run db:types`.

### Struttura

- `src/lib/supabase/`: client per browser, server e proxy, più i tipi del database.
- `src/proxy.ts`: aggiorna la sessione Supabase a ogni richiesta.
- `src/features/books/`: schema di validazione (zod), accesso ai dati (`repository.ts`, con `neverthrow`), ISBN e ricerca su Open Library.
- `GET /api/isbn/[isbn]`: restituisce una bozza di libro da Open Library (richiede login).

### Test

```bash
npm test
```
