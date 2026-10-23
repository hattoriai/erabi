import { expect, test } from "@playwright/test";
import { field, list, openPage, picker } from "./support";

test.describe("accessibility", () => {
  test("a select is a combobox with a listbox, named by its label", async ({ page }) => {
    await openPage(page);
    const status = page.getByRole("combobox", { name: "Status" });
    await expect(status).toHaveAttribute("aria-haspopup", "listbox");
    await status.click();
    await expect(page.getByRole("listbox", { name: "Status" })).toBeVisible();
    await expect(page.getByRole("option", { name: "To do" })).toHaveAttribute("aria-selected", "true");
  });

  test("a long list's popup is a dialog with a box that is a combobox", async ({ page }) => {
    await openPage(page);
    await expect(field(page, "task_item_picker")).toHaveAttribute("aria-haspopup", "dialog");
    await field(page, "task_item_picker").click();
    const filter = picker(page, "task_item_picker").getByRole("combobox", { name: "Search…" });
    await expect(filter).toBeFocused();
    await page.keyboard.press("ArrowDown");
    const active = await filter.getAttribute("aria-activedescendant");
    expect(active).toBeTruthy();
    await expect(page.locator(`#${active}`)).toHaveAttribute("role", "option");
  });

  test("the native select is out of sight and of the tab order once the picker is ready, and still posts", async ({ page }) => {
    await openPage(page);
    const native = picker(page, "task_status_picker").locator("select.erabi-native");
    await expect(native).toHaveAttribute("aria-hidden", "true");
    await expect(native).toHaveAttribute("tabindex", "-1");
    await expect(native).toHaveValue("todo");
  });

  test("changes are announced", async ({ page }) => {
    await openPage(page);
    await field(page, "task_labels_picker").click();
    await list(page, "task_labels_picker").getByRole("option", { name: "Docs" }).click();
    await expect(picker(page, "task_labels_picker").locator(".erabi-live")).toHaveText("Docs added");
  });

  test("words in the page's locale", async ({ page }) => {
    await openPage(page, "/?locale=pt-PT");
    await expect(field(page, "task_priority_picker")).toContainText("Escolher…");
  });
});
