import { expect, test as setup } from "@playwright/test";
import { expectSignedInAs, signIn } from "./support/app";
import { confirmationLink } from "./support/mailpit";
import { createMember, signupMode } from "./support/supabase";
import { admin, librarian, newcomer, reader } from "./support/users";

// Prepara l'istanza come la troverebbe una persona: database vuoto, il primo account
// diventa amministratore. Gli altri utenti si creano direttamente (senza email) e
// accedono con la password. Le sessioni salvate qui servono agli altri test.

setup("il primo utente si registra, conferma l'email e diventa amministratore", async ({ page }) => {
  expect(await signupMode(), "il database deve essere vuoto: lancia `npm run test:e2e`").toBe("first_admin");

  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "Crea un account" })).toBeVisible();
  await expect(page.getByText("il primo account diventa amministratore")).toBeVisible();

  await page.getByLabel("Nome").fill(admin.name);
  await page.getByLabel("Email").fill(admin.email);
  await page.getByLabel("Password", { exact: true }).fill(admin.password);
  await page.getByLabel("Ripeti la password").fill(admin.password);
  await page.getByRole("button", { name: "Registrati" }).click();
  await expect(page.getByRole("status")).toContainText("Ti abbiamo mandato un'email");

  // Il link dell'email passa da Supabase e torna su /auth/confirm, che apre la sessione.
  await page.goto(await confirmationLink(admin.email));
  await expect(page).toHaveURL(/127\.0\.0\.1:3100\/$/);
  await expectSignedInAs(page, admin);
  expect(await signupMode()).toBe("invite_only");

  await page.context().storageState({ path: admin.storageState });
});

setup("bibliotecario e lettore accedono con email e password", async ({ browser, baseURL }) => {
  for (const user of [librarian, reader, newcomer]) await createMember(user);

  for (const user of [librarian, reader]) {
    const context = await browser.newContext({ baseURL });
    const page = await context.newPage();
    await signIn(page, user);
    await expectSignedInAs(page, user);
    await context.storageState({ path: user.storageState });
    await context.close();
  }
});

setup("una password sbagliata non fa entrare", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(reader.email);
  await page.getByLabel("Password", { exact: true }).fill("password-sbagliata-1");
  await page.getByRole("button", { name: "Accedi", exact: true }).click();
  // Next aggiunge un suo role="alert" vuoto per annunciare i cambi di pagina: si cerca quello col testo.
  await expect(page.getByRole("alert").filter({ hasText: /\S/ })).toHaveText("Email o password non corretti.");
  await expect(page).toHaveURL(/\/login$/);
});
