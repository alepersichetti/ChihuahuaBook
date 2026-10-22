import { expect, test, type Page } from "@playwright/test";
import { collectionButton, sidebar } from "./support/app";
import { librarian } from "./support/users";

// Collezioni nella barra laterale: crearle, trascinarci i libri, spostarle nelle cartelle.

test.use({ storageState: librarian.storageState });

const bookRow = (page: Page, title: string) => page.getByRole("main").getByRole("row").filter({ hasText: title });

const createCollection = async (page: Page, name: string) => {
  await sidebar(page).getByRole("button", { name: "Nuova collezione" }).click();
  await sidebar(page).getByLabel("Nome della nuova collezione").fill(name);
  await sidebar(page).getByLabel("Nome della nuova collezione").press("Enter");
  await expect(collectionButton(page, name)).toHaveAttribute("aria-current", "page");
};

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.getByRole("group", { name: "Vista" }).getByRole("button", { name: "Tabella" }).click();
});

test("un libro trascinato su una collezione ci finisce dentro", async ({ page }) => {
  await createCollection(page, "Preferiti e2e");
  await expect(page.getByText("Questa collezione è vuota.")).toBeVisible();

  await collectionButton(page, "Libreria").click();
  await bookRow(page, "Il Gattopardo").dragTo(collectionButton(page, "Preferiti e2e"));

  await expect(sidebar(page).getByRole("status")).toHaveText("«Il Gattopardo» aggiunto a Preferiti e2e");
  await expect(collectionButton(page, "Preferiti e2e")).toHaveAccessibleName(/1$/);

  // Lo stesso libro una seconda volta non si duplica.
  await bookRow(page, "Il Gattopardo").dragTo(collectionButton(page, "Preferiti e2e"));
  await expect(sidebar(page).getByRole("status")).toHaveText("«Il Gattopardo» è già in Preferiti e2e");

  await collectionButton(page, "Preferiti e2e").click();
  await expect(bookRow(page, "Il Gattopardo")).toBeVisible();
  await expect(page.getByRole("main").getByRole("row")).toHaveCount(2); // intestazione + il libro
});

test("una collezione si sposta in una cartella trascinandola e ne esce dal menu", async ({ page }) => {
  await createCollection(page, "Classici e2e");

  await collectionButton(page, "Classici e2e").dragTo(collectionButton(page, "Autori"));
  await expect(sidebar(page).getByRole("status")).toHaveText("Classici e2e spostata in Autori");
  // Dentro la cartella la riga è rientrata rispetto a quella della cartella.
  const indent = (name: string) =>
    collectionButton(page, name).evaluate((button) => getComputedStyle(button.parentElement!).paddingLeft);
  await expect.poll(() => indent("Classici e2e")).toBe("16px");

  await collectionButton(page, "Classici e2e").hover();
  await sidebar(page).getByRole("button", { name: "Azioni per Classici e2e" }).click();
  await sidebar(page).getByRole("button", { name: "Fuori dalle cartelle" }).click();
  await expect(sidebar(page).getByRole("status")).toHaveText("Classici e2e spostata in Fuori dalle cartelle");
  await expect.poll(() => indent("Classici e2e")).toBe("0px");
});

test("dalla scheda del libro si aggiunge e si toglie una collezione", async ({ page }) => {
  await expect(collectionButton(page, "Calvino")).toHaveAccessibleName(/2$/);
  await bookRow(page, "Il Gattopardo").click();

  const picker = page.getByRole("combobox", { name: "Aggiungi a una collezione…" });
  await picker.fill("Calv");
  await page.getByRole("option", { name: /Calvino/ }).click();
  const remove = page.getByRole("button", { name: "Togli da Calvino" });
  await expect(remove).toBeVisible();
  await expect(collectionButton(page, "Calvino")).toHaveAccessibleName(/3$/);

  await remove.click();
  await expect(remove).toBeHidden();
  await expect(collectionButton(page, "Calvino")).toHaveAccessibleName(/2$/);
});
