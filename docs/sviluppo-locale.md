# Far girare ChihuahaBook in locale

Questa guida porta da zero a un'app funzionante sul proprio computer: interfaccia Next.js su `http://localhost:3000` e, se serve, un Supabase completo (Postgres, Auth, Storage) in Docker con lo schema del catalogo già applicato.

Ci sono due livelli, e il primo non richiede nulla oltre a Node:

1. **Solo interfaccia**: la libreria con i dati di esempio. Bastano Node e npm.
2. **Interfaccia + backend**: le API `/api/...` su un Supabase locale. Servono anche Docker e la CLI di Supabase.

> Le parti su Supabase, API e migrazioni valgono quando il backend (PR #2) è in `main`.

## Prerequisiti

| Strumento | Versione | A cosa serve |
| --- | --- | --- |
| [Node.js](https://nodejs.org/) | 22 LTS (minimo 20.9, richiesto da Next 16) | dev server, build, test |
| npm | quello incluso in Node | dipendenze (il repo ha `package-lock.json`) |
| Git | qualsiasi recente | clonare il repo |
| Docker | Docker Desktop, OrbStack, Colima o Podman | solo per Supabase locale |

La CLI di Supabase non va installata a parte: si usa con `npx supabase ...`, che la scarica al primo uso. Se preferisci averla fissa, su macOS va bene anche `brew install supabase/tap/supabase` (e allora nei comandi sotto togli `npx`).

Per Supabase locale conta di avere qualche GB libero su disco: la prima volta scarica una decina di immagini Docker.

## 1. Clonare e installare

```bash
git clone https://github.com/alepersichetti/ChihuahaBook.git
cd ChihuahaBook
npm ci
```

`npm ci` installa esattamente le versioni del lockfile. Usa `npm install` solo quando aggiungi o aggiorni una dipendenza.

## 2. Solo interfaccia

```bash
npm run dev
```

Apri <http://localhost:3000>. La libreria mostra i dati di esempio di `src/features/library/sample-library.ts` e funziona anche senza alcuna variabile d'ambiente. Le modifiche ai file si vedono subito (hot reload).

Senza configurazione Supabase la pagina funziona, mentre le API rispondono `500 misconfigured`: è normale, vedi il passo successivo.

## 3. Supabase in locale

### Avvio

Con Docker acceso, dalla cartella del progetto:

```bash
npx supabase start
```

La prima volta ci vogliono alcuni minuti per scaricare le immagini; poi bastano pochi secondi. Il comando:

- avvia Postgres, Auth, Storage, REST, Studio e un server di posta finto, con la configurazione di `supabase/config.toml`;
- applica in ordine tutte le migrazioni di `supabase/migrations/` (tabelle `books`, `collections`, `collection_books`, `loans`, RLS e bucket `covers`).

Alla fine stampa gli indirizzi e le chiavi. Per rivederli in qualsiasi momento:

```bash
npx supabase status
```

Indirizzi utili (porte di default):

| Servizio | Indirizzo |
| --- | --- |
| API Supabase | <http://127.0.0.1:54321> |
| Studio (interfaccia web del database) | <http://127.0.0.1:54323> |
| Mailpit (email di conferma e reset) | <http://127.0.0.1:54324> |
| Postgres diretto | `postgresql://postgres:postgres@127.0.0.1:54322/postgres` |

### Variabili d'ambiente

Copia l'esempio e compilalo con i valori di `npx supabase status`:

```bash
cp .env.example .env.local
```

```dotenv
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...   # "Publishable key" di supabase status
```

Al posto della publishable key va bene anche la vecchia `NEXT_PUBLIC_SUPABASE_ANON_KEY` (la "anon key"): il backend accetta entrambe, con o senza prefisso `NEXT_PUBLIC_`. `.env.local` è ignorato da Git, quindi le chiavi non finiscono nel repo.

Riavvia `npm run dev` dopo aver cambiato `.env.local`: Next legge le variabili solo all'avvio.

### Verificare che il backend risponda

```bash
curl -i http://localhost:3000/api/books
```

La risposta attesa è `401 {"error":"unauthenticated"}`: il backend è configurato e chiede un utente. L'interfaccia per il login non c'è ancora, quindi per provare le API con un utente vero:

1. Crea un utente da Studio (<http://127.0.0.1:54323> → Authentication → Add user) oppure da terminale. In locale le email non vanno confermate.

   ```bash
   KEY=sb_publishable_...   # la stessa chiave di .env.local

   curl -s http://127.0.0.1:54321/auth/v1/signup \
     -H "apikey: $KEY" -H "Content-Type: application/json" \
     -d '{"email":"io@example.com","password":"password123"}'
   ```

2. Fai il login e prendi il token:

   ```bash
   TOKEN=$(curl -s "http://127.0.0.1:54321/auth/v1/token?grant_type=password" \
     -H "apikey: $KEY" -H "Content-Type: application/json" \
     -d '{"email":"io@example.com","password":"password123"}' \
     | node -pe 'JSON.parse(require("fs").readFileSync(0)).access_token')
   ```

3. Chiama le API con il token:

   ```bash
   # crea un libro
   curl -s http://localhost:3000/api/books \
     -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
     -d '{"title":"Il nome della rosa","authors":["Umberto Eco"]}'

   # elenco
   curl -s http://localhost:3000/api/books -H "Authorization: Bearer $TOKEN"

   # bozza da Open Library a partire da un ISBN
   curl -s http://localhost:3000/api/isbn/9788845292613 -H "Authorization: Bearer $TOKEN"
   ```

L'elenco completo delle rotte è nel [README](../README.md#api). I libri creati si vedono anche in Studio, nella tabella `books`.

### Fermare e ripulire

```bash
npx supabase stop               # ferma i container, i dati restano
npx supabase stop --no-backup   # ferma e cancella i dati locali
npx supabase db reset           # ricrea il database da zero e riapplica tutte le migrazioni
```

## 4. Lavorare sullo schema

```bash
npx supabase migration new nome_modifica   # crea supabase/migrations/<timestamp>_nome_modifica.sql
# scrivi l'SQL nel file, poi:
npx supabase migration up                  # applica le migrazioni nuove al database locale
# oppure, per ripartire puliti:
npx supabase db reset
```

Dopo una migrazione rigenera i tipi TypeScript dal database locale:

```bash
npx supabase gen types typescript --local --schema public > src/server/adapters/supabase/database.types.ts
```

(`npm run db:types` fa la stessa cosa ma dal progetto Supabase remoto indicato in `SUPABASE_PROJECT_ID`.)

Per portare le migrazioni su un progetto Supabase nel cloud vedi la sezione "Backend (Supabase)" del [README](../README.md).

## 5. Test e controlli

| Comando | Cosa fa |
| --- | --- |
| `npm test` | test unitari con Vitest (non servono né Supabase né la rete) |
| `npm run test:watch` | come sopra, rieseguiti a ogni modifica |
| `npm run lint` | ESLint, compresi i confini tra `core`, `adapters`, `http` e Next |
| `npm run typecheck` | controllo dei tipi con `tsc` |
| `npm run build` | build di produzione, come su Vercel |
| `npm start` | serve la build su <http://localhost:3000> |

Per `typecheck` serve che Next abbia generato i suoi tipi (`LayoutProps` e simili): succede da solo dopo `npm run dev` o `npm run build`. Su un clone appena fatto lancia prima `npx next typegen`, altrimenti `tsc` segnala `Cannot find name 'LayoutProps'`.

## Problemi comuni

- **`Cannot connect to the Docker daemon`**: Docker non è avviato. Apri Docker Desktop (o `colima start`) e riprova.
- **Porta già in uso** (3000 o 5432x): un altro processo la occupa. Per Next usa `npm run dev -- -p 3001`; per Supabase ferma l'altro progetto con `npx supabase stop --project-id <nome>` oppure cambia le porte in `supabase/config.toml`.
- **`toomanyrequests` o `rate limit` durante `supabase start`**: Docker Hub limita i download anonimi. Fai `docker login` con un account gratuito e riprova.
- **`500 misconfigured` dalle API**: mancano `NEXT_PUBLIC_SUPABASE_URL` o la chiave in `.env.local`, oppure non hai riavviato `npm run dev` dopo averle aggiunte.
- **`401 unauthenticated`**: tutto a posto, manca solo il token (vedi sopra).
- **Dopo un `git pull` qualcosa non compila**: riesegui `npm ci`; se sono arrivate migrazioni nuove, `npx supabase migration up` (o `db reset`).
- **`AGENTS.md` risulta modificato dopo `npm run dev`**: Next 16 riscrive un blocco di quel file all'avvio. Se la modifica è solo quella, puoi committarla o scartarla.
