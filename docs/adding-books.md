# Adding a book

**English** · [Italiano](adding-books.it.md)

> The app interface is currently in Italian: button labels are quoted as they appear on screen.

The **Aggiungi** (add) button opens a dialog that first asks how to enter the book:

- **Inserimento manuale** (manual entry): an empty form.
- **Compilazione automatica** (automatic fill): pick an online catalogue, search by title, author or ISBN, and press **Usa** (use) on a result. The form opens already filled in, cover included, so you can check and fix it before saving.

A valid ISBN typed in the free search is recognised and searched as an ISBN. If the form's ISBN is already in your library, the dialog warns you.

Without a login or a configured Supabase the book is added only in the browser tab, and the dialog says so.

## Catalogues

| Catalogue | Key | Notes |
|---|---|---|
| Google Books | optional `GOOGLE_BOOKS_API_KEY` | Google Books searches the full text of books and magazines that Google has scanned, converted to text using optical character recognition (OCR), and stored in its digital database. Without a key Google applies a shared per-IP daily quota that runs out quickly: create a free key in the Google Cloud console (Books API) and set it on Vercel. |
| Open Library | none | Open Library is an open, editable library catalog, building towards a web page for every book ever published. Run by Internet Archive, it groups editions into works, so the ISBN is filled in only when you searched by ISBN. |

Covers are stored as links to the catalogue's image, not copied.

## API

- `GET /api/search/sources`: the active catalogues, as `[{ id, label }]`.
- `GET /api/search?source=google_books&q=eco&field=any|isbn|title|author&limit=20`: results as `[{ source, sourceId, link, draft }]`, where `draft` has the same fields as `POST /api/books`.

Both require a logged-in user.

## Adding a catalogue

Each catalogue is a `SearchSource` (`src/server/core/books/ports.ts`): an id, a label and a `search` function that turns a query into drafts. Write an adapter in `src/server/adapters/<name>/` and add it to `searchSources` in `src/server/app/index.ts`; the dialog lists it automatically (add a description in `src/features/add-book/api.ts`).

Amazon is not included for now. Bookpedia used Amazon's Product Advertising API 5, which Amazon has retired in favour of the Creators API; that requires an Amazon Associates account with qualifying sales, plus its credentials. Scraping Amazon pages is against its terms of use.
