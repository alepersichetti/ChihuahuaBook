import { expect, test, type Page } from "@playwright/test";
import { librarian, reader } from "./support/users";

// Statistiche: si aprono dalla barra laterale (anche per chi legge soltanto), un valore
// porta alla Libreria filtrata e un prestito apre la scheda del libro.

const statsButton = (page: Page) => page.getByRole("navigation", { name: "Collezioni" }).getByRole("button", { name: "Statistiche" });
const statsDialog = (page: Page) => page.getByRole("dialog", { name: "Statistiche" });

test.describe("bibliotecario", () => {
  test.use({ storageState: librarian.storageState });

  test("il pulsante apre le statistiche della Libreria", async ({ page }) => {
    await page.goto("/");
    await expect(statsButton(page)).toBeEnabled();
    await statsButton(page).click();
    const dialog = statsDialog(page);
    await expect(dialog).toBeVisible();
    for (const section of ["Stato di lettura", "Autori più presenti", "Anno di pubblicazione", "Prestiti in corso"]) {
      await expect(dialog.getByRole("region", { name: section })).toBeVisible();
    }
    // I prestiti della biblioteca di esempio: due, entrambi scaduti.
    const loans = dialog.getByRole("region", { name: "Prestiti in corso" });
    await expect(loans.getByRole("button")).toHaveCount(2);
    await expect(loans).toContainText("di ritardo");

    await dialog.getByRole("button", { name: "Chiudi" }).click();
    await expect(dialog).toBeHidden();
  });

  test("un autore nelle statistiche porta alla Libreria con solo i suoi libri", async ({ page }) => {
    await page.goto("/");
    await statsButton(page).click();
    await statsDialog(page)
      .getByRole("region", { name: "Autori più presenti" })
      .getByRole("button", { name: /^Italo Calvino: 2 libri/ })
      .click();
    await expect(statsDialog(page)).toBeHidden();
    await expect(page.getByRole("main").getByRole("heading", { name: "Libreria" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Autore: Italo Calvino/ })).toBeVisible();
    await expect(page.getByRole("main").getByText("2 libri", { exact: true }).first()).toBeVisible();
  });

  test("un prestito apre la scheda del libro", async ({ page }) => {
    await page.goto("/");
    await statsButton(page).click();
    await statsDialog(page).getByRole("region", { name: "Prestiti in corso" }).getByRole("button", { name: /Il Gattopardo/ }).click();
    await expect(statsDialog(page)).toBeHidden();
    await expect(page.getByRole("complementary", { name: "Dettagli del libro" })).toContainText("Il Gattopardo");
  });
});

test.describe("lettore", () => {
  test.use({ storageState: reader.storageState });

  test("anche chi legge soltanto vede le statistiche", async ({ page }) => {
    await page.goto("/");
    await statsButton(page).click();
    await expect(statsDialog(page).getByRole("region", { name: "Autori più presenti" })).toBeVisible();
  });
});

test.describe("telefono", () => {
  test.use({ storageState: librarian.storageState, viewport: { width: 390, height: 844 }, hasTouch: true });

  test("la scheda Statistiche in basso apre il pannello", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("navigation", { name: "Sezioni" }).getByRole("button", { name: "Statistiche" }).click();
    await expect(statsDialog(page)).toBeVisible();
  });
});
