import { expect, test, type Page } from "@playwright/test";
import { collectionButton, sidebar } from "./support/app";
import { pediaBooks, pediaName, pediaZip } from "./support/pedia";
import { booksTitled } from "./support/supabase";
import { librarian } from "./support/users";

// Import di un export di Bookpedia (.pedia compresso in zip): anteprima, salvataggio
// sul server con la copertina, e un secondo import identico che non crea doppioni.

test.use({ storageState: librarian.storageState });

const importZip = async (page: Page) => {
  await sidebar(page).getByRole("button", { name: "Importa .pedia" }).click();
  const dialog = page.getByRole("dialog", { name: "Importa da Bookpedia" });
  await dialog.getByLabel("Scegli lo zip del .pedia").setInputFiles(pediaZip());
  await expect(dialog.getByText(`2 libri pronti da importare da «${pediaName}».`)).toBeVisible();
  await expect(dialog.getByText("1 copertina abbinata.")).toBeVisible();
  await expect(dialog.getByRole("radio", { name: /Aggiungi solo le novità/ })).toBeChecked();
  await dialog.getByRole("button", { name: "Importa 2 libri" }).click();
  await expect(dialog.getByText(`2 libri aggiunti alla collezione «Bookpedia: ${pediaName}».`)).toBeVisible();
  return dialog;
};

test("un .pedia zippato viene letto, salvato sul server e diventa una collezione", async ({ page }) => {
  await page.goto("/");
  const dialog = await importZip(page);
  await expect(dialog.getByText(/^Sul server: 2 nuovi, 0 aggiornati; 1 copertina caricata\.$/)).toBeVisible();
  await dialog.getByRole("button", { name: "Fatto" }).click();

  await expect(collectionButton(page, `Bookpedia: ${pediaName}`)).toHaveAccessibleName(/2$/);
  for (const book of pediaBooks) {
    await expect(page.getByRole("main").getByText(book.title).first()).toBeVisible();
    expect(await booksTitled(book.title)).toHaveLength(1);
  }
  expect((await booksTitled(pediaBooks[0].title))[0].isbn13).toBe(pediaBooks[0].isbn);

  // Lo stesso file una seconda volta: niente doppioni, i libri risultano invariati.
  await page.reload();
  const again = await importZip(page);
  await expect(again.getByText(/^Sul server: 0 nuovi, 0 aggiornati, 2 invariati lasciati com'era/)).toBeVisible();
  for (const book of pediaBooks) expect(await booksTitled(book.title)).toHaveLength(1);
});
