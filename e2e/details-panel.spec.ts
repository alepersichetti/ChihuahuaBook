import { expect, test, type Page } from "@playwright/test";
import { librarian } from "./support/users";

// Tabella e Griglia: la scheda del libro a destra si allarga e si stringe trascinandone il bordo,
// entro limiti che dipendono dalla finestra; la larghezza scelta resta dopo aver ricaricato.

test.use({ storageState: librarian.storageState });

const handle = (page: Page) => page.getByRole("separator", { name: "Ridimensiona la scheda del libro" });
const details = (page: Page) => page.getByRole("complementary", { name: "Dettagli del libro" });

const showView = async (page: Page, view: "Tabella" | "Griglia") =>
  page.getByRole("group", { name: "Vista" }).getByRole("button", { name: view }).click();

const panelWidth = async (page: Page) => Math.round((await details(page).boundingBox())?.width ?? 0);

/** Trascina il bordo della scheda di `dx` pixel (negativo = verso sinistra, la scheda si allarga). */
const dragHandle = async (page: Page, dx: number) => {
  const box = await handle(page).boundingBox();
  if (!box) throw new Error("Maniglia non visibile");
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx / 2, y);
  await page.mouse.move(x + dx, y);
  await page.mouse.up();
};

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => window.localStorage.removeItem("chihuahuabook:details-width"));
  await page.reload();
  await showView(page, "Tabella");
  await page.getByRole("main").getByRole("row").filter({ hasText: "Il Gattopardo" }).click();
});

test("trascinando il bordo la scheda si allarga e la larghezza resta dopo aver ricaricato", async ({ page }) => {
  await expect(handle(page)).toHaveAttribute("aria-valuenow", "340");
  expect(await panelWidth(page)).toBe(340);

  await dragHandle(page, -200);
  await expect(handle(page)).toHaveAttribute("aria-valuenow", "540");
  expect(await panelWidth(page)).toBe(540);

  await page.reload();
  await expect(handle(page)).toHaveAttribute("aria-valuenow", "540");

  // Anche la Griglia usa la stessa larghezza e la stessa maniglia.
  await showView(page, "Griglia");
  await expect(handle(page)).toHaveAttribute("aria-valuenow", "540");
  await dragHandle(page, 100);
  await expect(handle(page)).toHaveAttribute("aria-valuenow", "440");
});

test("i limiti seguono la larghezza della finestra", async ({ page }) => {
  // 1440 px: da 288 a metà finestra.
  await expect(handle(page)).toHaveAttribute("aria-valuemin", "288");
  await expect(handle(page)).toHaveAttribute("aria-valuemax", "720");
  await dragHandle(page, -1000);
  await expect(handle(page)).toHaveAttribute("aria-valuenow", "720");

  // Finestra più stretta: il massimo lascia spazio ai libri e la scheda rientra da sola.
  await page.setViewportSize({ width: 1100, height: 900 });
  await expect(handle(page)).toHaveAttribute("aria-valuemax", "448");
  await expect(handle(page)).toHaveAttribute("aria-valuenow", "448");
  expect(await panelWidth(page)).toBe(448);

  await dragHandle(page, 1000);
  await expect(handle(page)).toHaveAttribute("aria-valuenow", "260");
});

test("si regola anche da tastiera e il doppio clic torna alla larghezza iniziale", async ({ page }) => {
  await handle(page).focus();
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowLeft");
  await expect(handle(page)).toHaveAttribute("aria-valuenow", "372");
  await page.keyboard.press("End");
  await expect(handle(page)).toHaveAttribute("aria-valuenow", "720");

  await handle(page).dblclick();
  await expect(handle(page)).toHaveAttribute("aria-valuenow", "340");
});

test("nella Galleria e sotto i 1024 px la scheda non ha la maniglia", async ({ page }) => {
  await showView(page, "Galleria");
  await expect(handle(page)).toHaveCount(0);

  await showView(page, "Tabella");
  await page.setViewportSize({ width: 900, height: 900 });
  await expect(handle(page)).toHaveCount(0);
});
