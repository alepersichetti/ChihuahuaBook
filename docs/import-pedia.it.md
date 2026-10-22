# Import dei file .pedia di Bookpedia

[English](import-pedia.md) · **Italiano**

Un file `.pedia` è una cartella (il Finder la mostra come un file unico) con un XML delle schede e le immagini delle copertine. L'import si apre dal pulsante **Importa .pedia** in fondo alla colonna delle collezioni.

## Cosa si può scegliere

- **Trascinare** il `.pedia` nella finestra: il browser legge tutta la cartella.
- **Uno zip** del `.pedia` (tasto destro nel Finder, «Comprimi»): è la strada più sicura, perché il selettore di file del Mac non sempre entra nei pacchetti.
- **La cartella** con il pulsante «Scegli la cartella».
- **Solo l'XML**, se le copertine non servono.

Il file viene letto interamente nel browser; al server arrivano solo i dati dei libri e le immagini, una richiesta alla volta (nessuna supera i limiti di dimensione di Vercel).

## Come vengono letti i dati

Il formato esatto dell'XML di Bookpedia non è documentato, quindi la lettura è tollerante:

- va bene sia un plist di Apple sia un XML «a elementi» (`<collection><item><title>…`), anche con i nomi dei campi in un attributo (`<field name="Title">`);
- i nomi dei campi vengono riconosciuti senza badare a maiuscole, spazi e punteggiatura (`Release Date`, `releaseDate`, `release_date`); l'elenco è in `src/server/core/books/pedia.ts`;
- i campi che il catalogo non ha finiscono nella colonna `extra` del libro, così non si perde nulla;
- le schede senza titolo vengono scartate e mostrate nell'anteprima.

Le copertine si abbinano per nome del file (id della scheda, ISBN o titolo). Se nessun nome corrisponde ma le immagini sono numerate (`1.jpg`, `2.jpg`…), si abbinano nell'ordine delle schede e l'anteprima lo segnala. Immagini TIFF, GIF o troppo grandi vengono convertite in JPEG nel browser, se il browser le sa leggere.

## Reimportare

Ogni libro importato ricorda la fonte (`source = 'bookpedia'`) e l'id della scheda d'origine (`source_id`); per le schede senza id si usa un'impronta di titolo, autori e ISBN. Reimportare lo stesso file quindi non crea doppioni: i libri già presenti vengono aggiornati, oppure lasciati come sono se si toglie la spunta «Aggiorna i libri già importati».

## API

| Metodo | Percorso | Corpo |
| --- | --- | --- |
| `POST` | `/api/import/books` | `{ source: "bookpedia", on_existing: "update" \| "skip", items: [{ source_id, book, extra }] }`, al massimo 100 libri; risponde con l'esito di ognuno |
| `PUT` | `/api/books/:id/cover` | l'immagine (JPEG, PNG o WebP, massimo 5 MB) con il suo `Content-Type`; la salva in `covers/<utente>/<libro>.<ext>` |

Finché l'interfaccia non è collegata a Supabase con l'accesso utente, i libri importati compaiono comunque nella libreria della scheda aperta (in una collezione con il nome del file), e la finestra dice che non sono stati salvati sul server.
