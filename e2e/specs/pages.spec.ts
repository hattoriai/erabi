import { expect, test } from "@playwright/test";
import { field, openPage, option } from "./support";

test("a picker on a page without LiveView posts with its form", async ({ page }) => {
  await openPage(page, "/plain");
  await field(page, "labels_picker").click();
  await option(page, "labels_picker", "Bug").click();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.locator("#query")).toHaveText("labels%5B%5D=&labels%5B%5D=docs&labels%5B%5D=bug");
});
