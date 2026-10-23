import { expect, test } from "@playwright/test";
import { chips, expectPosted, field, list, openPage, option, picker } from "./support";

test.describe("several values", () => {
  test("the list stays open as people check and uncheck", async ({ page }) => {
    await openPage(page);
    await field(page, "task_labels_picker").click();
    await expect(list(page, "task_labels_picker")).toHaveAttribute("aria-multiselectable", "true");
    await option(page, "task_labels_picker", "Docs").click();
    await expect(list(page, "task_labels_picker")).toBeVisible();
    await option(page, "task_labels_picker", "Bug").click();
    await expectPosted(page, "labels", ["", "a11y", "docs"]);
    expect(await chips(page, "task_labels_picker")).toEqual(["Accessibility", "Docs"]);
  });

  test("Backspace takes the last chip back; a chip's × takes it", async ({ page }) => {
    await openPage(page);
    await field(page, "task_labels_picker").focus();
    await page.keyboard.press("Backspace");
    await expectPosted(page, "labels", ["", "bug"]);
    await picker(page, "task_labels_picker").locator('.erabi-chip [data-remove="bug"]').click();
    await expectPosted(page, "labels", [""]);
  });

  test("past the rules' max, the others cannot be chosen", async ({ page }) => {
    await openPage(page);
    await field(page, "task_labels_picker").click();
    for (const label of ["Design", "Docs"]) await option(page, "task_labels_picker", label).click();
    await expect(option(page, "task_labels_picker", "Security")).toHaveAttribute("aria-disabled", "true");
    await option(page, "task_labels_picker", "Security").click({ force: true });
    expect(await chips(page, "task_labels_picker")).toHaveLength(4);
    await expect(picker(page, "task_labels_picker").locator(".erabi-live")).toHaveText("Choose 4 at most");
  });

  test("tags: typed, created with Enter or a comma, under the rules", async ({ page }) => {
    await openPage(page);
    const input = picker(page, "task_tags_picker").locator(".erabi-input");
    await input.click();
    await page.keyboard.type("fro");
    await expect(option(page, "task_tags_picker", "frontend")).toHaveClass(/erabi-active/);
    await page.keyboard.press("Enter");
    await page.keyboard.type("Data viz");
    await expect(option(page, "task_tags_picker", "Create “Data viz”")).toBeVisible();
    await page.keyboard.press("Enter");
    await page.keyboard.type("ops,");
    await expectPosted(page, "tags", ["", "frontend", "Data viz", "ops"]);
    await expect(input).toHaveValue("");

    await page.keyboard.type("!!");
    await expect(option(page, "task_tags_picker", "Create “!!”")).toHaveAttribute("aria-disabled", "true");
    await expect(option(page, "task_tags_picker", "Create “!!”")).toContainText("Not in the right form");
    await page.keyboard.press("Enter");
    expect(await chips(page, "task_tags_picker")).toEqual(["frontend", "Data viz", "ops"]);
  });

  test("people: me first and marked, agents marked, avatars", async ({ page }) => {
    await openPage(page);
    await field(page, "task_reviewer_ids_picker").click();
    const rows = list(page, "task_reviewer_ids_picker").locator('[role="option"]');
    await expect(rows.first()).toContainText("Rui Freitas");
    await expect(rows.first().locator(".erabi-me")).toHaveText("Me");
    await expect(option(page, "task_reviewer_ids_picker", "Claude").locator(".erabi-badge")).toHaveText("Agent");
    await expect(option(page, "task_reviewer_ids_picker", "Claude").locator('.erabi-avatar[data-kind="agent"]')).toBeVisible();
    await option(page, "task_reviewer_ids_picker", "Ada").click();
    await expectPosted(page, "reviewer_ids", ["", "2", "7", "1"]);
  });
});
