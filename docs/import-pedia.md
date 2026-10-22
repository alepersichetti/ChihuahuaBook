# Importing Bookpedia .pedia files

**English** · [Italiano](import-pedia.it.md)

> The app interface is currently in Italian: button labels are quoted as they appear on screen.

A `.pedia` file is a folder (Finder shows it as a single file) containing an XML file with the records and the cover images. The import opens from the **Importa .pedia** button at the bottom of the collections column.

## What you can pick

- **Drag** the `.pedia` into the window: the browser reads the whole folder.
- **A zip** of the `.pedia` (right click in Finder, «Compress»): this is the safest route, because the Mac file picker does not always enter packages.
- **The `.pedia` itself**, with the «Scegli il .pedia» (choose the .pedia) button.

Only the whole `.pedia` is accepted: the XML on its own is refused, because the covers would be missing.

The file is read entirely in the browser; the server only receives the book data and the images, one request at a time (none exceeds Vercel's size limits).

## The format

Checked against a real export (October 2026, 6334 books):

- `Info.xml` is an **Apple plist**: a dictionary mapping a running number (`1`, `2`…) to each book record, plus a `Version` entry;
- each record has `uid` (Bookpedia's internal, stable id: it becomes `source_id`), `title`, `author`, `editor`, `translator`, `illustrator`, `publisher`, `releaseDate`, `isbn`, `pages`, `format`, `edition`, `genre`, `series`, `summary`, `comments`, `myRating`, `price`, `purchasedOn`, `location`, `localeLanguage`, `dateAdded` and a few minor fields;
- people are written «Surname Name» and separated by commas (`Fruttero Carlo, Lucentini Franco`), like genres;
- `myRating` goes from 0 to 10 (0 = not rated) and becomes 0–5 stars;
- dates are stored as local midnight (`2004-06-30T22:00:00Z` is 1 July in Italy), so they are read in the browser's time zone;
- prices are free text (`Euro 25,00`, `9,30 EUR`): amount and currency are extracted;
- some texts contain control characters that XML does not allow: they are stripped before parsing;
- the `Cover` folder holds the images named after the book id. They are matched both by `uid` and by record number (the two ranges don't overlap).

Invalid ISBNs (for example the 18-digit codes of magazines) stay in `extra.isbn`. With the real file (43 MB of XML) parsing in the browser takes about fifteen seconds.

## How the data is read

Parsing is still lenient, so other layouts work too:

- both an Apple plist and an "element-based" XML (`<collection><item><title>…`) work, including field names given in an attribute (`<field name="Title">`);
- field names are matched ignoring case, spaces and punctuation (`Release Date`, `releaseDate`, `release_date`); the list is in `src/server/core/books/pedia.ts`;
- fields the catalogue doesn't have go into the book's `extra` column, so nothing is lost;
- records without a title are skipped and shown in the preview.

Covers are matched by file name (record id, ISBN or title). If no name matches but the images are numbered (`1.jpg`, `2.jpg`…), they are matched in record order and the preview says so. TIFF, GIF or oversized images are converted to JPEG in the browser, if the browser can read them.

## What's new, or replace

Every imported book remembers its source (`source = 'bookpedia'`), the id of the original record (`source_id`; for records without an id, a fingerprint of title, authors and ISBN) and a fingerprint of the record's content (`import_hash`). Re-importing therefore never creates duplicates. In the preview you choose how to proceed:

- **Add only what's new** (default): new books are added, books whose record changed in Bookpedia are updated, the others stay as they are (including edits made in the app). No book is deleted.
- **Replace the whole library**: every book in the file is rewritten as it is in its record and, at the end, every book that is not in the file is deleted (including books added by hand), with its loans, collection memberships and covers. Before going ahead the preview shows how many books will be deleted and a confirmation must be ticked. Deletion only starts once all records have been saved.

Both modes require the librarian or administrator role.

## API

| Method | Path | Body |
| --- | --- | --- |
| `POST` | `/api/import/books` | `{ source: "bookpedia", on_existing: "update" \| "changed" \| "skip", items: [{ source_id, book, extra }] }`, at most 100 books; replies with the outcome of each one (`created`, `updated`, `unchanged`, `skipped`, `failed`) |
| `POST` | `/api/import/prune` | `{ source: "bookpedia", keep_source_ids: [...], dry_run: true }`: counts (or, with `dry_run: false`, deletes) the books that match no record in the file |
| `PUT` | `/api/books/:id/cover` | the image (JPEG, PNG or WebP, at most 5 MB) with its `Content-Type`; saves it to `covers/<user>/<book>.<ext>` |

Until the interface is wired to Supabase with user sign-in, imported books still appear in the library of the open tab (in a collection named «Bookpedia: file name»), and the dialog says they were not saved on the server.
