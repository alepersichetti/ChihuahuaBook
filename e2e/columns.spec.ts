import { expect, test, type Page } from "@playwright/test";
import { customColumns } from "./support/supabase";
import { librarian, reader } from "./support/users";

// Colonne personalizzate: il bibliotecario le crea dal menu Colonne, le compila
// dalla scheda del libro, le rinomina e le elimina; il lettore le vede ma non le tocca.

const main = (page: Page) => page.getByRole("main");
const header = (page: Page, name: string) => main(page).getByRole("columnheader", { name, exact: true });
const bookRow = (page: Page, title: string) => main(page).getByRole("row").filter({ hasText: title });

// Il menu resta aperto finché non si clicca di nuovo "Colonne": lo si apre solo se è chiuso,
// altrimenti il secondo clic lo richiuderebbe.
const openColumnsMenu = async (page: Page) => {
  const menu = main(page).locator("details").filter({ has: page.getByText("Colonne", { exact: true }) });
  if (!(await menu.evaluate((element) => (element as HTMLDetailsElement).open))) {
    await main(page).getByText("Colonne", { exact: true }).click();
  }
  return main(page).locator("details[open]");
};

const showTable = async (page: Page) => {
  await page.goto("/");
  await page.getByRole("group", { name: "Vista" }).getByRole("button", { name: "Tabella" }).click();
};

test.describe("bibliotecario", () => {
  test.use({ storageState: librarian.storageState });

  test("crea una colonna, la compila, la filtra, la rinomina e la elimina", async ({ page }) => {
    await showTable(page);
    const menu = await openColumnsMenu(page);

    // Il nome di una colonna che c'è già non va bene, nemmeno se è una colonna fissa.
    await menu.getByRole("button", { name: "Nuova colonna" }).click();
    await menu.getByLabel("Nome della colonna").fill("Titolo");
    await menu.getByRole("button", { name: "Crea" }).click();
    await expect(menu.getByRole("alert")).toHaveText("C'è già una colonna con questo nome.");

    await menu.getByLabel("Nome della colonna").fill("Luogo d'acquisto");
    await menu.getByLabel("Tipo").selectOption({ label: "Testo" });
    await menu.getByRole("button", { name: "Crea" }).click();
    await expect(header(page, "Luogo d'acquisto")).toBeVisible();
    await expect(menu.getByRole("checkbox", { name: "Luogo d'acquisto" })).toBeChecked();
    await expect.poll(customColumns).toContainEqual(
      expect.objectContaining({ key: "luogodacquisto", label: "Luogo d'acquisto", kind: "text", extra_key: "luogodacquisto" }),
    );

    // Si compila dalla scheda del libro e compare nella cella.
    await bookRow(page, "Il Gattopardo").click();
    const field = page.getByLabel("Modifica Luogo d'acquisto");
    await field.fill("Libreria Feltrinelli");
    await field.press("Enter");
    await expect(bookRow(page, "Il Gattopardo")).toContainText("Libreria Feltrinelli");

    // Il filtro sotto l'intestazione funziona anche sulle colonne nuove.
    await main(page).getByLabel("Filtra per luogo d'acquisto").fill("feltri");
    await expect(main(page).getByRole("row")).toHaveCount(3); // intestazioni, filtri e il libro
    await main(page).getByRole("button", { name: "Togli filtri" }).click();

    // Rinominare cambia il nome per tutti; chiave e valori restano.
    const again = await openColumnsMenu(page);
    await again.getByRole("button", { name: "Rinomina la colonna Luogo d'acquisto" }).click();
    await again.getByLabel("Nuovo nome per Luogo d'acquisto").fill("Autore");
    await again.getByLabel("Nuovo nome per Luogo d'acquisto").press("Enter");
    await expect(again.getByRole("alert")).toHaveText("C'è già una colonna con questo nome.");
    await again.getByLabel("Nuovo nome per Luogo d'acquisto").fill("Negozio");
    await again.getByRole("button", { name: "Salva" }).click();
    await expect(header(page, "Negozio")).toBeVisible();
    await expect(header(page, "Luogo d'acquisto")).toHaveCount(0);
    await expect(bookRow(page, "Il Gattopardo")).toContainText("Libreria Feltrinelli");
    await expect.poll(customColumns).toContainEqual(expect.objectContaining({ key: "luogodacquisto", label: "Negozio" }));

    // Eliminare chiede conferma con un secondo clic.
    await again.getByRole("button", { name: "Elimina la colonna Negozio" }).click();
    await again.getByRole("button", { name: "Elimina", exact: true }).click();
    await expect(header(page, "Negozio")).toHaveCount(0);
    await expect.poll(async () => (await customColumns()).map((column) => column.key)).not.toContain("luogodacquisto");
  });
});

test.describe("lettore", () => {
  test.use({ storageState: reader.storageState });

  test("sceglie le colonne da vedere ma non ne crea né ne elimina", async ({ page }) => {
    await showTable(page);
    const menu = await openColumnsMenu(page);
    await expect(menu.getByRole("checkbox", { name: "Editore" })).toBeVisible();
    await expect(menu.getByRole("button", { name: "Nuova colonna" })).toHaveCount(0);
    await expect(menu.getByRole("button", { name: /^Rinomina la colonna/ })).toHaveCount(0);

    // Anche chiamando l'API direttamente.
    const created = await page.request.post("/api/columns", {
      data: { columns: [{ key: "abusiva", label: "Abusiva" }] },
      headers: { origin: new URL(page.url()).origin },
    });
    expect(created.status()).toBe(403);
    const renamed = await page.request.patch("/api/columns/abusiva", {
      data: { label: "x" },
      headers: { origin: new URL(page.url()).origin },
    });
    expect(renamed.status()).toBe(403);
    expect((await page.request.get("/api/columns")).status()).toBe(200);
  });
});
