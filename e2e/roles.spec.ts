import { expect, test, type Locator } from "@playwright/test";
import { collectionButton, expectSignedInAs, openSettings, sidebar, signIn } from "./support/app";
import { memberRole, setInstanceLanguage } from "./support/supabase";
import { admin, librarian, newcomer, reader } from "./support/users";

// Cosa vede ciascun ruolo e come l'amministratore cambia i ruoli dalle Impostazioni.
// Il server ricontrolla tutto: le prove passano anche dall'API, non solo dall'interfaccia.

const sectionTitles = (dialog: Locator) => dialog.getByRole("heading", { level: 3 });

test.describe("lettore", () => {
  test.use({ storageState: reader.storageState });

  test("consulta il catalogo ma non vede Impostazioni né i comandi di modifica", async ({ page }) => {
    await page.goto("/");
    await expect(collectionButton(page, "Libreria")).toBeVisible();
    await expect(page.getByRole("button", { name: "Impostazioni" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Aggiungi", exact: true })).toHaveCount(0);
    await expect(sidebar(page).getByRole("button", { name: "Importa .pedia" })).toHaveCount(0);
    await expect(sidebar(page).getByRole("button", { name: "Nuova collezione" })).toHaveCount(0);
    await expect(collectionButton(page, "Calvino")).not.toHaveAttribute("draggable", "true");

    // Anche chiamando l'API direttamente.
    expect((await page.request.get("/api/search/sources")).status()).toBe(403);
    expect((await page.request.get("/api/admin/members")).status()).toBe(403);
  });
});

test.describe("bibliotecario", () => {
  test.use({ storageState: librarian.storageState });

  test("apre le Impostazioni ma vede solo Aspetto e Informazioni", async ({ page }) => {
    await page.goto("/");
    const dialog = await openSettings(page);
    await expect(sectionTitles(dialog)).toHaveText(["Aspetto", "Informazioni"]);

    // La palette è una preferenza personale e si applica subito.
    await dialog.getByText("Scura", { exact: true }).click();
    await expect(page.locator("[data-palette]").first()).toHaveAttribute("data-palette", "dark");
    await dialog.getByRole("button", { name: "Chiudi" }).click();
    await expect(dialog).toBeHidden();

    expect((await page.request.get("/api/admin/members")).status()).toBe(403);
  });
});

test.describe("amministratore", () => {
  test.use({ storageState: admin.storageState });

  test.afterAll(() => setInstanceLanguage("it"));

  test("vede tutte le sezioni e promuove un lettore a bibliotecario", async ({ page, browser, baseURL }) => {
    await page.goto("/");
    const dialog = await openSettings(page);
    await expect(sectionTitles(dialog)).toHaveText(["Aspetto", "Lingua", "Utenti e ruoli", "Informazioni"]);

    const roles = dialog.getByRole("radiogroup", { name: `Ruolo di ${newcomer.name}` });
    await expect(roles.getByRole("radio", { name: "Lettore" })).toHaveAttribute("aria-checked", "true");
    await roles.getByRole("radio", { name: "Bibliotecario" }).click();
    await expect(roles.getByRole("radio", { name: "Bibliotecario" })).toHaveAttribute("aria-checked", "true");
    expect(await memberRole(newcomer.email)).toBe("librarian");

    // Diventare amministratore chiede conferma: annullando non cambia nulla.
    await roles.getByRole("radio", { name: "Amministratore" }).click();
    const confirm = dialog.getByRole("alertdialog");
    await expect(confirm).toContainText(`Promuovere ${newcomer.name} ad amministratore?`);
    await confirm.getByRole("button", { name: "Annulla" }).click();
    expect(await memberRole(newcomer.email)).toBe("librarian");

    // Il proprio ruolo non si cambia.
    await expect(
      dialog.getByRole("radiogroup", { name: `Ruolo di ${admin.name}` }).getByRole("radio", { name: "Lettore" }),
    ).toBeDisabled();

    // Il nuovo bibliotecario, appena entra, ha i comandi di modifica.
    const context = await browser.newContext({ baseURL });
    const newcomerPage = await context.newPage();
    await signIn(newcomerPage, newcomer);
    await expectSignedInAs(newcomerPage, { ...newcomer, role: "librarian" });
    await expect(newcomerPage.getByRole("button", { name: "Aggiungi", exact: true })).toBeVisible();
    await context.close();
  });

  test("invita una persona per email", async ({ page }) => {
    await page.goto("/");
    const dialog = await openSettings(page);
    await dialog.getByLabel("Email", { exact: true }).fill("invitata@example.com");
    await dialog.getByRole("button", { name: "Invita" }).click();
    await expect(dialog.getByRole("button", { name: "Annulla l'invito a invitata@example.com" })).toBeVisible();
  });

  test("cambia la lingua dell'app per tutti", async ({ page }) => {
    await page.goto("/");
    const dialog = await openSettings(page);
    await dialog.getByRole("radiogroup", { name: "Lingua" }).getByRole("radio", { name: "English" }).click();
    await expect(page.getByRole("dialog", { name: "Settings" })).toBeVisible();

    await page.reload();
    await expect(sidebar(page)).toHaveCount(0); // il nome della barra laterale ora è in inglese
    await expect(page.getByRole("navigation", { name: "Collections" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Add", exact: true })).toBeVisible();
  });
});
