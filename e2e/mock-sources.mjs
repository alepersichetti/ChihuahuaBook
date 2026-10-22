#!/usr/bin/env node
// Finto server per i cataloghi online usati da "Aggiungi un libro": risponde come
// Google Books (/google/books/v1/volumes) e Open Library (/openlibrary/search.json,
// /openlibrary/api/books). L'app ci arriva tramite GOOGLE_BOOKS_API_URL e OPEN_LIBRARY_URL.
// Una ricerca che contiene "nessunrisultato" restituisce un elenco vuoto.

import { createServer } from "node:http";

const googleVolume = {
  id: "e2e-pendolo",
  volumeInfo: {
    title: "Il pendolo di Foucault",
    authors: ["Umberto Eco"],
    publisher: "Bompiani",
    publishedDate: "1988-10-01",
    description: "Tre redattori inventano per gioco un complotto che diventa vero.",
    industryIdentifiers: [
      { type: "ISBN_13", identifier: "9788845278679" },
      { type: "ISBN_10", identifier: "8845278670" },
    ],
    pageCount: 509,
    categories: ["Fiction"],
    language: "it",
    canonicalVolumeLink: "https://books.google.com/books?id=e2e-pendolo",
  },
};

const openLibraryDoc = {
  key: "/works/OL-e2e-W",
  title: "Il deserto dei Tartari",
  author_name: ["Dino Buzzati"],
  publisher: ["Mondadori"],
  first_publish_year: 1940,
  number_of_pages_median: 240,
  subject: ["Romanzo"],
  language: ["ita"],
};

const empty = (text) => text.toLowerCase().includes("nessunrisultato");

const routes = {
  "/health": () => ({ ok: true }),
  "/google/books/v1/volumes": (params) =>
    empty(params.get("q") ?? "") ? { totalItems: 0 } : { totalItems: 1, items: [googleVolume] },
  "/openlibrary/search.json": (params) =>
    empty([...params.values()].join(" ")) ? { numFound: 0, docs: [] } : { numFound: 1, docs: [openLibraryDoc] },
  "/openlibrary/api/books": () => ({}),
};

const port = Number(process.env.E2E_MOCK_PORT ?? 4010);

createServer((request, response) => {
  const url = new URL(request.url ?? "/", `http://${request.headers.host}`);
  const handler = routes[url.pathname];
  response.writeHead(handler ? 200 : 404, { "content-type": "application/json" });
  response.end(JSON.stringify(handler ? handler(url.searchParams) : { error: "not_found" }));
}).listen(port, "127.0.0.1", () => console.log(`Finti cataloghi su http://127.0.0.1:${port}`));
