# Custom columns

Besides the catalog columns (title, author, year…), the table can have columns made for your
own library: "Place of purchase", "Awards", "Dewey" and so on. They apply to every member of
the instance.

## Who can do what

| Role | Sees the columns | Shows or hides them | Creates, deletes and fills them |
| --- | --- | --- | --- |
| Reader | yes | yes | no |
| Librarian | yes | yes | yes |
| Admin | yes | yes | yes |

The server checks roles again (API and RLS), not just the interface.

## In the interface

- **Create**: *Columns* menu above the table → *New column*, name and type (text, number, date).
  The name can't repeat another column's, not even a built-in one. The column shows up right away
  in the table you're looking at; in other collections you turn it on from the menu.
- **Fill in**: in the book details, *More fields* section. Enter or leaving the field saves, Esc
  cancels. Values that come from a catalog field (e.g. the translator) are read-only.
- **Filter and sort**: like any other column. Number columns accept `>10`, `<=3`, `1-5`; dates can
  be searched as `2024-03-12` or `12/03/2024`.
- **Delete**: bin icon next to the column in the menu, then *Delete*. The column disappears for
  everyone; values stay in the books and come back if you recreate it with the same name.

## Importing a .pedia

The import shows every column in the file. Fields the table already knows use the built-in
columns; the others become custom columns, created if missing (a column with the same normalized
name is reused as it is). The import collection shows the file's columns that have at least one
value; the table you were looking at adds the ones it didn't have. Fields that are always empty or
always `0` (e.g. checkboxes never ticked) become hidden columns you can turn on from the *Columns*
menu. More in [import-pedia.md](import-pedia.md).

## Data

Table `custom_columns` (migration `20261101180000_custom_columns.sql`):

| Field | Meaning |
| --- | --- |
| `key` | Normalized key (lowercase letters and digits): "Place of purchase" → `placeofpurchase` |
| `label` | Displayed name |
| `kind` | `text`, `number` or `date` |
| `extra_key` | For free values: the key in `books.extra`, as it was in the file (e.g. `placePublished`) |
| `catalog_field` | Alternatively: the `books` column to read from (e.g. `translators`, `edition`) |
| `position` | Order in the menu |

A column has either `extra_key` or `catalog_field`, never both. Free values are written with
`set_book_field(book_id, field_key, field_value)`, which only touches that key of `extra`
(`null` or empty text removes it).

## API

| Method | Path | Role | |
| --- | --- | --- | --- |
| GET | `/api/columns` | reader | The columns, in order |
| POST | `/api/columns` | librarian | `{ columns: [{ key, label, kind?, extra_key?, catalog_field? }] }`: creates the missing ones, returns all |
| DELETE | `/api/columns/:key` | librarian | Deletes the column (not the values) |
| PUT | `/api/books/:id/fields/:key` | librarian | `{ value: string \| null }`: writes or removes the value |

Without a server (sample data in `npm run dev`) changes stay in the browser.
