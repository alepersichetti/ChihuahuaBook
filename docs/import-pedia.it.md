# Import dei file .pedia di Bookpedia

[English](import-pedia.md) · **Italiano**

Un file `.pedia` è una cartella (il Finder la mostra come un file unico) con un XML delle schede e le immagini delle copertine. L'import si apre dal pulsante **Importa .pedia** in fondo alla colonna delle collezioni.

## Cosa si può scegliere

- **Trascinare** il `.pedia` nella finestra: il browser legge tutta la cartella.
- **Uno zip** del `.pedia` (tasto destro nel Finder, «Comprimi»): è la strada più sicura, perché il selettore di file del Mac non sempre entra nei pacchetti.
- **La cartella** con il pulsante «Scegli la cartella».
- **Solo l'XML**, se le copertine non servono.

Il file viene letto interamente nel browser; al server arrivano solo i dati dei libri e le immagini, una richiesta alla volta (nessuna supera i limiti di dimensione di Vercel).

## Il formato

Verificato su un export reale (ottobre 2026, 6334 libri):

- `Info.xml` è un **plist di Apple**: un dizionario che associa un numero progressivo (`1`, `2`…) alla scheda del libro, più una voce `Version`;
- ogni scheda ha `uid` (l'id interno di Bookpedia, stabile: diventa `source_id`), `title`, `author`, `editor`, `translator`, `illustrator`, `publisher`, `releaseDate`, `isbn`, `pages`, `format`, `edition`, `genre`, `series`, `summary`, `comments`, `myRating`, `price`, `purchasedOn`, `location`, `localeLanguage`, `dateAdded` e altri campi minori;
- le persone sono scritte «Cognome Nome» e separate da virgole (`Fruttero Carlo, Lucentini Franco`), come i generi;
- `myRating` va da 0 a 10 (0 = nessun voto) e diventa 0–5 stelle;
- le date sono salvate a mezzanotte dell'ora locale (`2004-06-30T22:00:00Z` è il 1° luglio in Italia), quindi si leggono nel fuso del browser;
- i prezzi sono testo libero (`Euro 25,00`, `9,30 EUR`): si prendono importo e valuta;
- alcuni testi contengono caratteri di controllo che l'XML non ammette: vengono tolti prima della lettura;
- la cartella `Cover` contiene le immagini con l'id del libro come nome. Si abbinano sia per `uid` sia per il numero della scheda (i due intervalli non si sovrappongono).

Gli ISBN non validi (per esempio i codici a 18 cifre delle riviste) restano in `extra.isbn`. Con il file reale (43 MB di XML) la lettura nel browser richiede una quindicina di secondi.

## Come vengono letti i dati

La lettura è comunque tollerante, così funziona anche con altri formati:

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

Finché l'interfaccia non è collegata a Supabase con l'accesso utente, i libri importati compaiono comunque nella libreria della scheda aperta (in una collezione «Bookpedia: nome del file»), e la finestra dice che non sono stati salvati sul server.
