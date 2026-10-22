import { expect, test, type Page } from "@playwright/test";
import { booksTitled } from "./support/supabase";
import { librarian } from "./support/users";

// Aggiunta di un libro da parte di un bibliotecario: a mano oppure da un catalogo online.
// Google Books e Open Library sono finti (e2e/mock-sources.mjs): i dati sono sempre gli stessi.

test.use({ storageState: librarian.storageState });

const openAddBook = async (page: Page) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Aggiungi", exact: true }).click();
  // Il titolo (e quindi il nome) della finestra cambia a ogni passo: si cerca la finestra aperta.
  const dialog = page.getByRole("dialog");
  await expect(dialog).toHaveAccessibleName("Aggiungi un libro");
  await expect(dialog.getByText("Come vuoi inserire il libro?")).toBeVisible();
  return dialog;
};

test("inserimento manuale: il libro viene salvato e compare nella libreria", async ({ page }) => {
  const title = "Diario di un test manuale";
  const dialog = await openAddBook(page);
  await dialog.getByRole("button", { name: /Inserimento manuale/ }).click();

  // Senza titolo non si salva.
  await dialog.getByRole("button", { name: "Salva nella libreria" }).click();
  await expect(dialog.getByText("Il titolo è obbligatorio")).toBeVisible();

  await dialog.getByLabel("Titolo *").fill(title);
  await dialog.getByLabel("Autori (separati da virgola)").fill("Anna Autrice, Bruno Coautore");
  await dialog.getByLabel("Anno").fill("2024");
  await dialog.getByRole("button", { name: "Salva nella libreria" }).click();

  await expect(dialog.getByText(`«${title}» è nella libreria.`)).toBeVisible();
  await expect(dialog.getByText("Non salvato sul server")).toHaveCount(0);
  await dialog.getByRole("button", { name: "Fatto" }).click();
  await expect(dialog).toBeHidden();

  await expect(page.getByRole("main").getByText(title).first()).toBeVisible();
  expect(await booksTitled(title)).toEqual([
    { title, isbn13: null, authors: ["Anna Autrice", "Bruno Coautore"] },
  ]);
});

test("compilazione automatica da Google Books", async ({ page }) => {
  const dialog = await openAddBook(page);
  await dialog.getByRole("button", { name: /Compilazione automatica/ }).click();
  await expect(dialog.getByText("Da quale catalogo prendo i dati?")).toBeVisible();
  await dialog.getByRole("button", { name: /^Google Books/ }).click();

  await dialog.getByLabel("Testo da cercare").fill("pendolo");
  await dialog.getByRole("button", { name: "Cerca", exact: true }).click();
  const hit = dialog.getByRole("listitem").filter({ hasText: "Il pendolo di Foucault" });
  await expect(hit).toContainText("Umberto Eco");
  await expect(hit).toContainText("ISBN 9788845278679");
  await hit.getByRole("button", { name: "Usa" }).click();

  await expect(dialog.getByText("Dati compilati da Google Books")).toBeVisible();
  await expect(dialog.getByLabel("Titolo *")).toHaveValue("Il pendolo di Foucault");
  await expect(dialog.getByLabel("Editore")).toHaveValue("Bompiani");
  await expect(dialog.getByLabel("Anno")).toHaveValue("1988");
  await dialog.getByRole("button", { name: "Salva nella libreria" }).click();

  await expect(dialog.getByText("«Il pendolo di Foucault» è nella libreria.")).toBeVisible();
  expect(await booksTitled("Il pendolo di Foucault")).toEqual([
    { title: "Il pendolo di Foucault", isbn13: "9788845278679", authors: ["Umberto Eco"] },
  ]);
});

test("compilazione automatica da Open Library, anche quando non trova niente", async ({ page }) => {
  const dialog = await openAddBook(page);
  await dialog.getByRole("button", { name: /Compilazione automatica/ }).click();
  await dialog.getByRole("button", { name: /^Open Library/ }).click();

  await dialog.getByLabel("Testo da cercare").fill("nessunrisultato");
  await dialog.getByRole("button", { name: "Cerca", exact: true }).click();
  await expect(dialog.getByText("Nessun risultato su Open Library.")).toBeVisible();

  await dialog.getByLabel("Cerca in").selectOption({ label: "Titolo" });
  await dialog.getByLabel("Testo da cercare").fill("deserto dei Tartari");
  await dialog.getByRole("button", { name: "Cerca", exact: true }).click();
  await dialog.getByRole("listitem").filter({ hasText: "Il deserto dei Tartari" }).getByRole("button", { name: "Usa" }).click();

  await expect(dialog.getByText("Dati compilati da Open Library")).toBeVisible();
  await expect(dialog.getByLabel("Autori (separati da virgola)")).toHaveValue("Dino Buzzati");
  await dialog.getByRole("button", { name: "Salva nella libreria" }).click();
  await expect(dialog.getByText("«Il deserto dei Tartari» è nella libreria.")).toBeVisible();
  expect(await booksTitled("Il deserto dei Tartari")).toHaveLength(1);
});
