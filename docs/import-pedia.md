# Importing Bookpedia .pedia files

**English** · [Italiano](import-pedia.it.md)

> The app interface is currently in Italian: button labels are quoted as they appear on screen.

A `.pedia` file is a folder (Finder shows it as a single file) containing an XML file with the records and the cover images. The import opens from the **Importa .pedia** button at the bottom of the collections column.

## What you can pick

- **Drag** the `.pedia` into the window: the browser reads the whole folder.
- **A zip** of the `.pedia` (right click in Finder, «Compress»): this is the safest route, because the Mac file picker does not always enter packages.
- **The folder**, with the «Scegli la cartella» (choose folder) button.
- **Just the XML**, if you don't need the covers.

The file is read entirely in the browser; the server only receives the book data and the images, one request at a time (none exceeds Vercel's size limits).

## How the data is read

Bookpedia's exact XML format is not documented, so parsing is lenient:

- both an Apple plist and an "element-based" XML (`<collection><item><title>…`) work, including field names given in an attribute (`<field name="Title">`);
- field names are matched ignoring case, spaces and punctuation (`Release Date`, `releaseDate`, `release_date`); the list is in `src/server/core/books/pedia.ts`;
- fields the catalogue doesn't have go into the book's `extra` column, so nothing is lost;
- records without a title are skipped and shown in the preview.

Covers are matched by file name (record id, ISBN or title). If no name matches but the images are numbered (`1.jpg`, `2.jpg`…), they are matched in record order and the preview says so. TIFF, GIF or oversized images are converted to JPEG in the browser, if the browser can read them.

## Re-importing

Every imported book remembers its source (`source = 'bookpedia'`) and the id of the original record (`source_id`); for records without an id, a fingerprint of title, authors and ISBN is used. Re-importing the same file therefore creates no duplicates: books already present are updated, or left as they are if you untick «Aggiorna i libri già importati in passato» (update previously imported books).

## API

| Method | Path | Body |
| --- | --- | --- |
| `POST` | `/api/import/books` | `{ source: "bookpedia", on_existing: "update" \| "skip", items: [{ source_id, book, extra }] }`, at most 100 books; replies with the outcome of each one |
| `PUT` | `/api/books/:id/cover` | the image (JPEG, PNG or WebP, at most 5 MB) with its `Content-Type`; saves it to `covers/<user>/<book>.<ext>` |

Until the interface is wired to Supabase with user sign-in, imported books still appear in the library of the open tab (in a collection named after the file), and the dialog says they were not saved on the server.
