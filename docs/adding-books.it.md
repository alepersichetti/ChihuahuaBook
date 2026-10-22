# Aggiungere un libro

[English](adding-books.md) · **Italiano**

Il pulsante **Aggiungi** apre una finestra che chiede prima come inserire il libro:

- **Inserimento manuale**: un modulo vuoto.
- **Compilazione automatica**: scegli un catalogo online, cerchi per titolo, autore o ISBN e premi **Usa** sul risultato. Il modulo si apre già compilato, copertina compresa, così puoi controllarlo e correggerlo prima di salvare.

Un ISBN valido scritto nella ricerca libera viene riconosciuto e cercato come ISBN. Se l'ISBN del modulo è già nella libreria, la finestra ti avvisa.

Senza accesso o senza Supabase configurato il libro viene aggiunto solo nella scheda del browser, e la finestra lo dice.

## Cataloghi

| Catalogo | Chiave | Note |
|---|---|---|
| Google Books | facoltativa, `GOOGLE_BOOKS_API_KEY` | Google Books cerca nel testo completo dei libri e delle riviste che Google ha scansionato, convertito in testo con il riconoscimento ottico dei caratteri (OCR) e archiviato nel suo database digitale. Senza chiave Google applica una quota giornaliera condivisa per IP che si esaurisce presto: crea una chiave gratuita nella console Google Cloud (Books API) e impostala su Vercel. |
| Open Library | nessuna | Open Library è un catalogo aperto e modificabile da tutti, che punta ad avere una pagina web per ogni libro mai pubblicato. Gestito da Internet Archive, raggruppa le edizioni in opere, quindi l'ISBN viene compilato solo se hai cercato per ISBN. |

Le copertine restano collegamenti all'immagine del catalogo, non vengono copiate.

## API

- `GET /api/search/sources`: i cataloghi attivi, come `[{ id, label }]`.
- `GET /api/search?source=google_books&q=eco&field=any|isbn|title|author&limit=20`: i risultati come `[{ source, sourceId, link, draft }]`, dove `draft` ha gli stessi campi di `POST /api/books`.

Entrambe richiedono un utente con accesso.

## Aggiungere un catalogo

Ogni catalogo è una `SearchSource` (`src/server/core/books/ports.ts`): un id, un nome e una funzione `search` che trasforma una ricerca in bozze. Scrivi un adattatore in `src/server/adapters/<nome>/` e aggiungilo a `searchSources` in `src/server/app/index.ts`; la finestra lo elenca da sola (aggiungi una descrizione in `src/features/add-book/api.ts`).

Amazon per ora non c'è. Bookpedia usava la Product Advertising API 5, che Amazon ha dismesso a favore della Creators API: questa richiede un account Amazon Associates con vendite qualificate e le relative credenziali. Leggere le pagine di Amazon con uno scraper viola i suoi termini d'uso.
