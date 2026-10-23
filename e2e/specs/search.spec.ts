import { expect, test } from "@playwright/test";
import { expectPosted, field, list, openPage, option, picker, posted } from "./support";

test.describe("search", () => {
  test("a combobox finds options on the server as people type, with the letters marked", async ({ page }) => {
    await openPage(page);
    const input = picker(page, "task_city_picker").locator(".erabi-input");
    await input.click();
    await page.keyboard.type("lis");
    await expect(option(page, "task_city_picker", "Lisbon")).toBeVisible();
    await expect(option(page, "task_city_picker", "Lisbon").locator("mark")).toHaveText("Lis");
    await page.keyboard.press("Enter");
    await expectPosted(page, "city", "Lisbon");
    await expect(input).toHaveValue("Lisbon");
  });

  test("a slow search says it is searching, then shows what it found", async ({ page }) => {
    await openPage(page);
    await field(page, "slow_picker").click();
    await page.keyboard.type("por");
    await expect(list(page, "slow_picker")).toContainText("Searching…");
    await expect(option(page, "slow_picker", "Porto")).toBeVisible();
    await page.keyboard.press("Enter");
    await expect.poll(async () => (await posted(page)).slow).toBe("Porto");
  });

  test("a combobox with create keeps what people typed", async ({ page }) => {
    await openPage(page);
    const input = picker(page, "place_picker").locator(".erabi-input");
    await input.click();
    await page.keyboard.type("Sintra");
    await page.keyboard.press("Tab");
    await expect.poll(async () => (await posted(page)).place).toBe("Sintra");
  });
});
