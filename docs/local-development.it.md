# Far girare ChihuahuaBook in locale

[English](local-development.md) · **Italiano**

Guida passo passo per far girare ChihuahuaBook sul proprio computer: il database (Supabase in Docker), il server Next.js e una checklist per verificare che tutto funzioni, dal primo amministratore all'import di un file `.pedia`.

Ci sono due modi:

| | Cosa ottieni | Cosa serve | Tempo |
| --- | --- | --- | --- |
| **A. Modalità demo** | l'interfaccia con dati di esempio e un amministratore finto, non si salva nulla | Node | 5 minuti |
| **B. Stack completo** | accesso vero, ruoli, database, copertine, import, cataloghi online | Node + Docker | 15 minuti la prima volta |

## Avvio rapido: tutto con un comando

Con Docker acceso:

```bash
git clone https://github.com/alepersichetti/ChihuahuaBook.git
cd ChihuahuaBook
npm ci
npm run dev:all
```

Apri <http://127.0.0.1:3000> e passa alla [checklist di verifica](#5-checklist-di-verifica). `Ctrl+C` ferma tutto.

`npm run dev:all` (`scripts/dev.mjs`) fa in ordine quello che i passi 3 e 4 qui sotto spiegano a mano:

1. controlla che Docker risponda;
2. avvia il Supabase locale (`npx supabase start`, senza i servizi che l'app non usa), che la prima volta scarica le immagini Docker;
3. applica le migrazioni nuove (`npx supabase migration up --local`);
4. legge indirizzo e chiave da `npx supabase status` e, se `.env.local` non esiste, lo crea;
5. avvia `next dev` su `127.0.0.1:3000` e stampa gli indirizzi di app, Studio, Mailpit e Postgres;
6. con `Ctrl+C` ferma il server e poi Supabase (`npx supabase stop`: i dati restano).

Opzioni:

```bash
npm run dev:all -- --keep-db   # lascia Supabase acceso all'uscita: il prossimo avvio è immediato
npm run dev:all -- -p 3001     # gli altri argomenti vanno a next dev
```

`dev:all` usa sempre il database locale: indirizzo e chiave di `supabase status` hanno la precedenza su quelli di `.env.local`, mentre le altre variabili di `.env.local` (come `GOOGLE_BOOKS_API_KEY`) restano valide. Funziona allo stesso modo su macOS, Linux e Windows.

Il resto della guida spiega i passi uno per uno, per quando vuoi lanciarli separatamente o qualcosa non va. Per la modalità demo bastano i passi 1 e 2; per lo stack completo i passi 1 e 3–6.

## 0. Prerequisiti

| Strumento | Versione | A cosa serve |
| --- | --- | --- |
| [Node.js](https://nodejs.org/) | 22 LTS (minimo 20.9, richiesto da Next 16) | server, build, test |
| npm | quello incluso in Node | dipendenze (il repo ha `package-lock.json`) |
| Git | qualsiasi recente | clonare il repo |
| Docker | Docker Desktop, OrbStack, Colima o Podman | solo per il database locale |
| `psql` (facoltativo) | qualsiasi | lanciare i test del database da terminale |

La CLI di Supabase non va installata a parte: si usa con `npx supabase ...`, che la scarica al primo uso. Se preferisci averla fissa, su macOS va bene anche `brew install supabase/tap/supabase` (e allora nei comandi sotto togli `npx`).

Conta qualche GB libero su disco: il primo avvio del database scarica una decina di immagini Docker.

## 1. Clonare e installare

```bash
git clone https://github.com/alepersichetti/ChihuahuaBook.git
cd ChihuahuaBook
npm ci
```

`npm ci` installa esattamente le versioni del lockfile. Usa `npm install` solo quando aggiungi o aggiorni una dipendenza.

> Non lanciare `npm audit fix --force`. `npm audit` segnala alcune vulnerabilità negli strumenti di sviluppo (ESLint e i suoi plugin, che non arrivano mai al browser né al server: `npm audit --omit=dev` non ne trova). `--force` le "risolve" riportando `eslint-config-next` alla versione 14, che non è compatibile con Next 16 e rompe sia `npm ci` sia `npm run lint`.

## 2. Modalità demo (senza database)

```bash
npm run dev
```

Apri <http://localhost:3000>. Sei dentro come amministratore demo e la libreria mostra i libri di esempio di `src/features/library/sample-library.ts`. Non si salva nulla: ricaricando torna tutto com'era.

Per vedere l'app con un altro ruolo o in inglese:

```bash
DEMO_ROLE=reader npm run dev       # reader | librarian | admin
DEMO_LANGUAGE=en npm run dev       # it | en
```

In modalità demo le API rispondono `500 misconfigured` perché manca il database: è normale. L'utente demo esiste solo con `npm run dev`; una build di produzione senza configurazione risponde `503` a ogni pagina.

Ferma il server con `Ctrl+C`.

## 3. Il database

Il database è un Supabase completo (Postgres, Auth, Storage, API REST, Studio e un server di posta finto) che gira in Docker, configurato da `supabase/config.toml`.

### 3.1 Avviarlo

Con Docker acceso, dalla cartella del progetto:

```bash
npx supabase start
```

La prima volta ci vogliono alcuni minuti per scaricare le immagini; poi pochi secondi. Alla fine stampa indirizzi e chiavi. Per rivederli:

```bash
npx supabase status
```

| Servizio | Indirizzo |
| --- | --- |
| API Supabase | <http://127.0.0.1:54321> |
| Studio (interfaccia web del database) | <http://127.0.0.1:54323> |
| Mailpit (tutte le email inviate dall'app) | <http://127.0.0.1:54324> |
| Postgres diretto | `postgresql://postgres:postgres@127.0.0.1:54322/postgres` |

### 3.2 Cosa contiene

All'avvio la CLI applica le migrazioni di `supabase/migrations/`, in ordine di nome:

| Migrazione | Cosa crea |
| --- | --- |
| `20261022140000_catalog.sql` | tabelle `books`, `collections`, `collection_books`, `loans`; ricerca testuale; il bucket privato `covers` (JPEG, PNG e WebP, al massimo 5 MB) |
| `20261022160000_roles.sql` | `members` (ruolo e stato di ogni utente), `invitations`, `instance_settings` (lingua, modalità di registrazione); il trigger di registrazione che fa amministratore il primo utente; le regole RLS per ruolo su tabelle e copertine |
| `20261022180000_import_hash.sql` | la colonna `import_hash`, che permette a un nuovo import `.pedia` di capire quali libri sono cambiati |

Per controllare che siano state applicate tutte:

```bash
npx supabase migration list --local
```

### 3.3 Guardarlo in Studio

Apri <http://127.0.0.1:54323>:

- **Table Editor**: le tabelle di `public`. Su un database nuovo sono vuote, tranne `instance_settings`, che ha una riga (lingua `it`, registrazione su invito).
- **Authentication → Users**: gli account. Vuoto fino alla prima registrazione.
- **Storage → covers**: le copertine, in `covers/<id utente>/<id libro>.<estensione>`.
- **SQL Editor**: query sul database.

Studio si collega come amministratore e **ignora la RLS**: mostra tutte le righe, qualunque sia il ruolo. Per vedere cosa vede un utente usa le query del punto 3.4.

### 3.4 Verificare le regole di sicurezza (RLS)

I test automatici in `supabase/tests/roles.test.sql` controllano 30 regole (primo amministratore, inviti, cosa può leggere e scrivere ogni ruolo, copertine, l'ultimo amministratore che non si può togliere, visitatori anonimi). Vanno lanciati su un database **vuoto** e alla fine annullano tutto:

```bash
npx supabase db reset
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -v ON_ERROR_STOP=1 -f supabase/tests/roles.test.sql
```

Ogni controllo stampa `NOTICE: ok: ...`; il primo che fallisce ferma lo script con `FALLITO: ...`.

Senza `psql` installato, apri il file, copialo nell'SQL Editor di Studio ed eseguilo.

Per provare una regola a mano quando ci sono utenti (dopo il passo 5), dall'SQL Editor:

```sql
begin;
-- impersona un utente (l'id va letto prima di cambiare ruolo)
select set_config('request.jwt.claim.sub',
  (select user_id::text from public.members where email = 'reader@example.com'), true);
set local role authenticated;

select public.member_role();                        -- reader
select count(*) from public.books;                  -- la lettura funziona
insert into public.books (title) values ('Prova');  -- errore: violates row-level security policy
rollback;
```

Con l'email di un bibliotecario o di un amministratore lo stesso `insert` va a buon fine (e `rollback` lo annulla).

### 3.5 Azzerare, dati di prova, fermare

```bash
npx supabase db reset           # svuota il database e riapplica tutte le migrazioni (e supabase/seed.sql, se c'è)
npx supabase stop               # ferma i container, i dati restano
npx supabase stop --no-backup   # li ferma e cancella i dati
```

Nel repo non c'è un `supabase/seed.sql`: i libri li creano gli utenti dall'app (passo 5), e il primo utente deve registrarsi dall'app per diventare amministratore. Se vuoi libri di prova dopo ogni reset, crea `supabase/seed.sql` con `insert into public.books (title, authors) values (...)`. Git non lo ignora, quindi non metterci dati personali.

Dopo `db reset` spariscono anche gli utenti: si riparte dal punto 5.1.

### 3.6 Modificare lo schema

```bash
npx supabase migration new nome_modifica   # crea supabase/migrations/<timestamp>_nome_modifica.sql
# scrivi l'SQL nel file, poi:
npx supabase migration up                  # applica le migrazioni nuove al database locale
```

Poi rigenera i tipi TypeScript dal database locale:

```bash
npx supabase gen types typescript --local --schema public > src/server/adapters/supabase/database.types.ts
```

(`npm run db:types` fa lo stesso dal progetto remoto indicato in `SUPABASE_PROJECT_ID`.) Per portare le migrazioni su un progetto nel cloud vedi la sezione "Backend (Supabase)" del [README](../README.it.md).

## 4. Configurare e avviare il server

### 4.1 Variabili d'ambiente

```bash
cp .env.example .env.local
```

Compila `.env.local` con i valori di `npx supabase status`:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...   # "Publishable key"

# Facoltativa: una chiave tua della Books API di Google (Google Cloud console → API → Books API).
# Senza, Google Books usa una quota giornaliera condivisa che si esaurisce presto.
GOOGLE_BOOKS_API_KEY=
```

Al posto della publishable key va bene anche la vecchia "anon key" in `NEXT_PUBLIC_SUPABASE_ANON_KEY`. `SUPABASE_PROJECT_ID` serve solo per `npm run db:types`. `.env.local` è ignorato da Git.

### 4.2 Avvio

```bash
npm run dev
```

(`npm run dev:all` fa 3.1, 4.1 e 4.2 in un colpo solo: vedi l'[avvio rapido](#avvio-rapido-tutto-con-un-comando).)

Apri **<http://127.0.0.1:3000>** (non `localhost`): i link delle email di conferma puntano a `127.0.0.1:3000`, come impostato in `supabase/config.toml`, e il browser tiene la sessione separata per i due nomi.

Next legge `.env.local` solo all'avvio: riavvia il server dopo averlo cambiato.

### 4.3 Controllo veloce

```bash
curl -i http://127.0.0.1:3000/api/books
```

`401 {"error":"unauthenticated"}` vuol dire che il server raggiunge il database e chiede un utente. `500 misconfigured` vuol dire che manca `.env.local` o che il server non è stato riavviato.

## 5. Checklist di verifica

Seguila in ordine su un database nuovo (`npx supabase db reset`). Tutte le email arrivano in Mailpit, <http://127.0.0.1:54324>. Le password vogliono almeno 10 caratteri, con lettere e cifre.

Per tenere aperti più utenti insieme usa browser diversi o finestre private.

### 5.1 Primo amministratore

- [ ] <http://127.0.0.1:3000> porta alla pagina di accesso, che dice che l'istanza è nuova e che il primo account diventa amministratore.
- [ ] Registrati con un'email (es. `admin@example.com`). La pagina chiede di confermare l'email.
- [ ] In Mailpit apri l'email e clicca il link: entri nella libreria, vuota.
- [ ] In Studio, `members` ha la tua riga con `role = admin`.
- [ ] Tornando alla pagina di accesso (**Esci** dal menu account, in alto a destra), ora dice che la registrazione è su invito.

### 5.2 Inviti e ruoli

In **Impostazioni** (in basso a sinistra) → **Utenti e accessi**:

- [ ] Invita `lib@example.com` come **Bibliotecario** e `reader@example.com` come **Lettore**. Compaiono sotto Inviti, con la scadenza (14 giorni).
- [ ] In un altro browser registrati come `stranger@example.com`, che non è invitato: la registrazione viene rifiutata.
- [ ] Registrati come `lib@example.com` e conferma da Mailpit: entra come bibliotecario. L'invito sparisce dalla lista.
- [ ] Lo stesso per `reader@example.com`.
- [ ] Da lettore: niente pulsante **Aggiungi**, niente comandi di modifica, Impostazioni non si apre.
- [ ] Da bibliotecario: ci sono Aggiungi e Importa .pedia; in Impostazioni solo Aspetto e Informazioni, niente Lingua né Utenti e accessi.
- [ ] Da amministratore prova a toglierti il ruolo: l'interfaccia non lo permette. Disattiva il lettore: ricaricando vede la libreria vuota.
- [ ] Riattiva il lettore.

### 5.3 Aggiungere libri

Da amministratore o bibliotecario, con il pulsante **Aggiungi**:

- [ ] **Inserimento manuale**: compila almeno il titolo e salva. Il libro compare nella lista e in Studio, tabella `books`.
- [ ] **Compilazione automatica → Google Books**: cerca `eco nome della rosa`, premi **Usa** su un risultato: il modulo si apre già compilato, copertina compresa. Salva. Senza `GOOGLE_BOOKS_API_KEY` la ricerca può fallire per la quota: dipende da Google, non dall'app.
- [ ] **Compilazione automatica → Open Library**: cerca per ISBN, es. `9788845292613`. Se l'ISBN è già in libreria, la finestra lo segnala.
- [ ] La copertina del libro salvato è in Studio → Storage → `covers`.
- [ ] Da lettore i libri nuovi si vedono ma non si possono modificare.

### 5.4 Import di un `.pedia`

Usa un export di Bookpedia (la cartella `.pedia`, il suo zip o solo `Info.xml`). I dettagli sono in [import-pedia.it.md](import-pedia.it.md).

- [ ] **Importa .pedia** (in basso a sinistra): trascina il file. L'anteprima dice quanti libri ha trovato e quante copertine ha abbinato.
- [ ] Importa con **Aggiungi solo le novità**. Alla fine i libri sono in libreria, con le copertine.
- [ ] Importa di nuovo lo stesso file: non si duplica nulla (i libri risultano invariati).
- [ ] Modifica un libro a mano e reimporta con **Aggiungi solo le novità**: la tua modifica resta.
- [ ] Importa con **Sostituisci tutta la libreria**: l'anteprima dice quanti libri verranno eliminati (quelli aggiunti a mano al punto 5.3) e chiede conferma. Dopo l'import restano solo i libri del file.

### 5.5 Interfaccia

- [ ] I tre pulsanti della vista nella barra in alto: **Tabella** (colonne da ordinare e scegliere), **Griglia** (copertine, dimensione in Impostazioni → Aspetto), **Galleria** (copertine a scorrimento).
- [ ] Impostazioni → Aspetto → **Palette colori**: Chiara, Calda, Scura. La scelta vale per il browser.
- [ ] Da amministratore, Impostazioni → **Lingua** → English: tutta l'interfaccia cambia, per tutti gli utenti, pagina di accesso compresa. Poi rimetti l'italiano se vuoi.
- [ ] Menu account → **Cambia password**, poi esci e rientra con la password nuova.
- [ ] Pagina di accesso → **Password dimenticata?**: l'email arriva in Mailpit e il link permette di scegliere una password nuova.

## 6. Le API da terminale

Ogni rotta vuole un utente attivo. Per avere il token di un utente creato al passo 5:

```bash
KEY=sb_publishable_...   # la stessa chiave di .env.local

TOKEN=$(curl -s "http://127.0.0.1:54321/auth/v1/token?grant_type=password" \
  -H "apikey: $KEY" -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"la-tua-password"}' \
  | node -pe 'JSON.parse(require("fs").readFileSync(0)).access_token')

curl -s http://127.0.0.1:3000/api/me -H "Authorization: Bearer $TOKEN"            # utente e ruolo
curl -s http://127.0.0.1:3000/api/books -H "Authorization: Bearer $TOKEN"         # elenco
curl -s http://127.0.0.1:3000/api/books -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Il nome della rosa","authors":["Umberto Eco"]}'                   # crea
curl -s "http://127.0.0.1:3000/api/search?source=open_library&q=9788845292613&field=isbn" \
  -H "Authorization: Bearer $TOKEN"                                               # catalogo online
```

Con il token del lettore il `POST` risponde `403`. L'elenco completo delle rotte è nel [README](../README.it.md).

## 7. Build di produzione

Per provare l'app come gira su Vercel:

```bash
npm run build
npm start          # http://127.0.0.1:3000, legge .env.local
```

Senza configurazione Supabase una build di produzione risponde `503` a ogni pagina: la modalità demo non c'è.

## 8. Controlli automatici

| Comando | Cosa fa |
| --- | --- |
| `npm run dev:all` | database e server insieme (vedi l'[avvio rapido](#avvio-rapido-tutto-con-un-comando)) |
| `npm test` | test unitari con Vitest (non servono né database né rete) |
| `npm run test:watch` | come sopra, rieseguiti a ogni modifica |
| `npm run lint` | ESLint, compresi i confini tra `core`, `adapters`, `http` e Next |
| `npm run typecheck` | controllo dei tipi con `tsc` |
| `npm run build` | build di produzione |
| `psql ... -f supabase/tests/roles.test.sql` | i test della RLS (vedi 3.4) |

Per `typecheck` servono i tipi che genera Next (`LayoutProps` e simili): compaiono dopo `npm run dev` o `npm run build`. Su un clone appena fatto lancia prima `npx next typegen`, altrimenti `tsc` segnala `Cannot find name 'LayoutProps'`.

## Problemi comuni

- **`npm ci` fallisce con `ERESOLVE` su `eslint-config-next`**: qualcuno ha lanciato `npm audit fix --force` (vedi passo 1). Rimetti `"eslint-config-next": "16.4.2"` e `"eslint-plugin-boundaries": "^7.2.1"` in `package.json` e lancia `npm install`.
- **`Cannot connect to the Docker daemon`**: Docker non è avviato. Apri Docker Desktop (o `colima start`) e riprova.
- **`toomanyrequests` o `rate limit` durante `supabase start`**: Docker Hub limita i download anonimi. Fai `docker login` con un account gratuito e riprova.
- **Porta già in uso** (3000 o 5432x): per Next usa `npm run dev -- -p 3001` (e aggiungi quell'indirizzo ad `additional_redirect_urls` in `supabase/config.toml`); per Supabase ferma l'altro progetto con `npx supabase stop --project-id <nome>`.
- **Il link di conferma dà errore o riporta all'accesso**: hai aperto l'app su `localhost` invece che su `127.0.0.1`, oppure il link è già stato usato. Registrati di nuovo da <http://127.0.0.1:3000>.
- **"Registrazione su invito" su un database nuovo**: c'è già un utente. Controlla Studio → Authentication → Users, oppure riparti con `npx supabase db reset`.
- **Amministratore chiuso fuori**: nell'SQL Editor di Studio, `update public.members set role = 'admin', active = true where email = 'tu@example.com';`
- **`500 misconfigured` dalle API**: in `.env.local` manca l'indirizzo o la chiave, oppure il server non è stato riavviato.
- **Google Books non trova nulla o dà errore di quota**: imposta `GOOGLE_BOOKS_API_KEY` in `.env.local` e riavvia, oppure usa Open Library.
- **Dopo un `git pull` qualcosa non compila**: riesegui `npm ci`; se sono arrivate migrazioni nuove, `npx supabase migration up` (o `db reset`).
- **Compare `AGENTS.md` dopo `npm run dev`**: lo genera Next 16 all'avvio. Non fa parte del repo: cancellalo o lascialo fuori dai commit.
