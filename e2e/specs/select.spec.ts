import { expect, test } from "@playwright/test";
import { expectPosted, field, list, openPage, option, picker } from "./support";

test.describe("select", () => {
  test("the keyboard opens the list, moves and chooses, and the form posts it", async ({ page }) => {
    await openPage(page);
    const status = field(page, "task_status_picker");
    await status.focus();
    await expect(status).toHaveAttribute("aria-expanded", "false");
    await page.keyboard.press("ArrowDown");
    await expect(status).toHaveAttribute("aria-expanded", "true");
    await expect(list(page, "task_status_picker")).toBeVisible();

    // The chosen value is the active row as the list opens.
    const active = await status.getAttribute("aria-activedescendant");
    await expect(page.locator(`#${active}`)).toHaveText(/To do/);

    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await expectPosted(page, "status", "doing");
    await expect(status).toHaveAttribute("aria-expanded", "false");
    await expect(status).toBeFocused();
    await expect(status).toContainText("In progress");
  });

  test("groups have their headings, and a click chooses", async ({ page }) => {
    await openPage(page);
    await field(page, "task_status_picker").click();
    await expect(list(page, "task_status_picker").locator(".erabi-heading")).toHaveText(["Not started", "Started", "Finished"]);
    await option(page, "task_status_picker", "Done").click();
    await expectPosted(page, "status", "done");
  });

  test("typing a letter moves to the option that starts so", async ({ page }) => {
    await openPage(page);
    const status = field(page, "task_status_picker");
    await status.focus();
    await page.keyboard.type("in r");
    const active = await status.getAttribute("aria-activedescendant");
    await expect(page.locator(`#${active}`)).toHaveText(/In review/);
  });

  test("Escape closes the list, keeps the value and stops there", async ({ page }) => {
    await openPage(page);
    await page.evaluate(() => {
      (window as unknown as { escapes: number }).escapes = 0;
      document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") (window as unknown as { escapes: number }).escapes++;
      });
    });
    const status = field(page, "task_status_picker");
    await status.click();
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Escape");
    await expect(status).toHaveAttribute("aria-expanded", "false");
    await expect(status).toContainText("To do");
    expect(await page.evaluate(() => (window as unknown as { escapes: number }).escapes)).toBe(0);
  });

  test("an app's icons, drawn in the list", async ({ page }) => {
    await openPage(page);
    await field(page, "task_priority_picker").click();
    await expect(option(page, "task_priority_picker", "Urgent").locator(".erabi-option-icon svg")).toBeVisible();
  });

  test("a long list has a box to filter it, and draws only the rows on screen", async ({ page }) => {
    await openPage(page);
    await field(page, "task_item_picker").click();
    const filter = picker(page, "task_item_picker").locator(".erabi-filter");
    await expect(filter).toBeFocused();
    expect(await list(page, "task_item_picker").locator('[role="option"]').count()).toBeLessThan(60);
    await page.keyboard.press("End");
    await expect(list(page, "task_item_picker").locator(".erabi-active")).toContainText("Item 5000");
    await expect(list(page, "task_item_picker").locator(".erabi-active")).toHaveAttribute("aria-posinset", "5000");

    await filter.fill("item 0042");
    await expect(list(page, "task_item_picker").locator(".erabi-active")).toContainText("Item 0042");
    await page.keyboard.press("Enter");
    await expectPosted(page, "item", "42");
    await expect(field(page, "task_item_picker")).toBeFocused();
  });

  test("a clear button empties it", async ({ page }) => {
    await openPage(page);
    await field(page, "task_owner_id_picker").locator(".erabi-clear").click();
    await expectPosted(page, "owner_id", "");
  });

  test("outside a form, the picker pushes its event", async ({ page }) => {
    await openPage(page);
    await field(page, "view_picker").click();
    await option(page, "view_picker", "Calendar").click();
    await expect(page.locator("#picked")).toHaveText('"calendar"');
  });
});
