# Colonne personalizzate

Oltre alle colonne del catalogo (titolo, autore, anno…), la tabella può avere colonne create
per la propria biblioteca: «Luogo d'acquisto», «Premi», «Dewey» e così via. Valgono per tutti
i membri dell'istanza.

## Chi può fare cosa

| Ruolo | Vede le colonne | Le mostra o nasconde | Crea, rinomina, elimina e compila |
| --- | --- | --- | --- |
| Lettore | sì | sì | no |
| Bibliotecario | sì | sì | sì |
| Amministratore | sì | sì | sì |

Il server ricontrolla i ruoli (API e RLS), non solo l'interfaccia.

## Dall'interfaccia

- **Creare**: menu *Colonne* sopra la tabella → *Nuova colonna*, nome e tipo (testo, numero,
  data). Il nome non può ripetere quello di un'altra colonna, nemmeno di una fissa. La colonna
  compare subito nella tabella che si sta guardando; nelle altre collezioni si attiva dal menu.
- **Compilare**: nella scheda del libro, sezione *Altri campi*. Invio o uscire dal campo salva,
  Esc annulla. I valori che vengono da un campo del catalogo (es. il traduttore) si leggono soltanto.
- **Filtrare e ordinare**: come le altre colonne. Sulle colonne di numeri il filtro accetta `>10`,
  `<=3`, `1-5`; le date si cercano come `2024-03-12` o `12/03/2024`.
- **Rinominare**: icona della matita accanto alla colonna nel menu, nuovo nome, Invio. Cambia solo
  il nome mostrato, per tutti; la chiave e i valori restano.
- **Eliminare**: icona del cestino accanto alla colonna nel menu, poi *Elimina*. La colonna
  sparisce per tutti; i valori restano nei libri e tornano se la si ricrea con lo stesso nome.

## Import di un .pedia

L'import mostra tutte le colonne del file. I campi che la tabella conosce già usano le colonne
fisse; gli altri diventano colonne personalizzate, create se mancano (una colonna con lo stesso
nome normalizzato viene riusata così com'è). La collezione dell'import mostra le colonne del file
che hanno almeno un valore; la tabella che si stava guardando aggiunge quelle che non aveva.
I campi sempre vuoti o sempre a `0` (es. le caselle mai spuntate) diventano colonne nascoste,
da attivare dal menu *Colonne*. Dettagli in [import-pedia.it.md](import-pedia.it.md).

## Dati

Tabella `custom_columns` (migrazione `20261101180000_custom_columns.sql`):

| Campo | Significato |
| --- | --- |
| `key` | Chiave normalizzata (minuscole e cifre): «Luogo d'acquisto» → `luogodacquisto` |
| `label` | Nome mostrato |
| `kind` | `text`, `number` o `date` |
| `extra_key` | Per i valori liberi: la chiave in `books.extra`, com'era nel file (es. `placePublished`) |
| `catalog_field` | In alternativa: la colonna di `books` da cui leggere (es. `translators`, `edition`) |
| `position` | Ordine nel menu |

Una colonna ha `extra_key` oppure `catalog_field`, mai entrambi. I valori liberi si scrivono con
la funzione `set_book_field(book_id, field_key, field_value)`, che tocca solo quella chiave di
`extra` (`null` o testo vuoto la toglie).

## API

| Metodo | Percorso | Ruolo | |
| --- | --- | --- | --- |
| GET | `/api/columns` | lettore | Le colonne, in ordine |
| POST | `/api/columns` | bibliotecario | `{ columns: [{ key, label, kind?, extra_key?, catalog_field? }] }`: crea quelle che mancano, restituisce tutte |
| PATCH | `/api/columns/:key` | bibliotecario | `{ label }`: nuovo nome (la chiave non cambia) |
| DELETE | `/api/columns/:key` | bibliotecario | Elimina la colonna (non i valori) |
| PUT | `/api/books/:id/fields/:key` | bibliotecario | `{ value: string \| null }`: scrive o toglie il valore |

Senza server (dati di esempio in `npm run dev`) le modifiche restano nel browser.
