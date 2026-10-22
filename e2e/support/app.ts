import { expect, type Page } from "@playwright/test";
import type { TestUser } from "./users";

// Azioni ricorrenti sull'interfaccia, scritte come le farebbe una persona.

const roleNames = { reader: "Lettore", librarian: "Bibliotecario", admin: "Amministratore" } as const;

export const signIn = async (page: Page, user: TestUser) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Accedi" })).toBeVisible();
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password", { exact: true }).fill(user.password);
  await page.getByRole("button", { name: "Accedi", exact: true }).click();
  await page.waitForURL((url) => url.pathname === "/");
};

/** Il menu dell'account mostra chi è collegato e con quale ruolo. */
export const expectSignedInAs = async (page: Page, user: TestUser) => {
  await page.getByRole("button", { name: "Account" }).click();
  const menu = page.getByRole("menu");
  await expect(menu).toContainText(user.email);
  await expect(menu).toContainText(roleNames[user.role]);
  await page.keyboard.press("Escape");
};

export const sidebar = (page: Page) => page.getByRole("navigation", { name: "Collezioni" });

/** Una voce della barra laterale: il nome accessibile comprende anche il numero di libri. */
export const collectionButton = (page: Page, name: string) =>
  sidebar(page).getByRole("button", { name: new RegExp(`^${name}\\s*(\\d+|esclusa)?$`) });

export const openSettings = async (page: Page) => {
  await page.getByRole("button", { name: "Impostazioni" }).click();
  const dialog = page.getByRole("dialog", { name: "Impostazioni" });
  await expect(dialog).toBeVisible();
  return dialog;
};
