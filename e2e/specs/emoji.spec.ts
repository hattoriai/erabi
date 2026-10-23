import { expect, test } from "@playwright/test";
import { expectPosted, field, openPage, picker } from "./support";

// The emoji and icon pickers: the data of the page's language, fetched as
// the picker first opens; a search; categories; tones; recent emoji; the
// app's icons.
test.describe("emoji", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.clear());
  });

  test("the keyboard searches, moves in the grid and chooses; the form posts the emoji", async ({ page }) => {
    await openPage(page);
    const icon = field(page, "task_page_icon_picker");
    await icon.focus();
    await page.keyboard.press("Enter");
    const search = picker(page, "task_page_icon_picker").getByRole("combobox", { name: "Search emoji…" });
    await expect(search).toBeFocused();
    const grid = picker(page, "task_page_icon_picker").getByRole("listbox");
    await expect(grid.getByRole("group", { name: "Smileys & emotion" })).toBeVisible();

    await page.keyboard.type("party");
    await expect(grid.getByRole("group", { name: "Results" }).getByRole("option").first()).toHaveAccessibleName("party popper");
    const active = await search.getAttribute("aria-activedescendant");
    await expect(page.locator(`#${active}`)).toHaveText("🎉");
    await page.keyboard.press("ArrowRight");
    await expect(page.locator(`#${await search.getAttribute("aria-activedescendant")}`)).toHaveText("🥳");
    await expect(picker(page, "task_page_icon_picker").locator(".erabi-emoji-preview")).toContainText("Partying face");
    await page.keyboard.press("Enter");

    await expectPosted(page, "page_icon", "🥳");
    await expect(icon).toBeFocused();
    await expect(icon).toContainText("Partying face");
  });

  test("a category jumps to its emoji; a chosen emoji is recent next time", async ({ page }) => {
    await openPage(page);
    await field(page, "task_page_icon_picker").click();
    const popup = picker(page, "task_page_icon_picker");
    await popup.getByRole("button", { name: "Food & drink" }).click();
    const food = popup.getByRole("group", { name: "Food & drink" });
    await expect(food).toBeInViewport();
    await food.getByRole("option", { name: "taco" }).click();
    await expectPosted(page, "page_icon", "🌮");

    await field(page, "task_page_icon_picker").click();
    await expect(popup.getByRole("group", { name: "Recent" }).getByRole("option")).toHaveText(["🌮"]);
    await expect(popup.getByRole("option", { name: "taco" }).nth(1)).toHaveAttribute("aria-selected", "true");
  });

  test("a skin tone is kept, and chosen emoji have it", async ({ page }) => {
    await openPage(page);
    await field(page, "task_page_icon_picker").click();
    const popup = picker(page, "task_page_icon_picker");
    await popup.getByRole("button", { name: "Skin tone" }).click();
    await popup.getByRole("radio", { name: "medium skin tone" }).click();
    await page.keyboard.type("waving hand");
    await page.keyboard.press("Enter");
    await expectPosted(page, "page_icon", "👋🏽");
    expect(await page.evaluate(() => localStorage.getItem("erabi-emoji-tone"))).toBe("3");
  });

  test("the app's icons are a tab of their own, and post their values", async ({ page }) => {
    await openPage(page);
    await field(page, "task_page_icon_picker").click();
    const popup = picker(page, "task_page_icon_picker");
    await popup.getByRole("tab", { name: "Icons" }).click();
    await expect(popup.getByRole("tab", { name: "Icons" })).toHaveAttribute("aria-selected", "true");
    await page.keyboard.type("rock");
    await page.keyboard.press("Enter");
    await expectPosted(page, "page_icon", "rocket");
    await expect(field(page, "task_page_icon_picker")).toContainText("Rocket");
    await expect(field(page, "task_page_icon_picker").locator(".erabi-values svg")).toBeVisible();
  });

  test("an icon picker: the icons alone, with a search", async ({ page }) => {
    await openPage(page);
    const section = field(page, "task_section_icon_picker");
    await section.focus();
    await page.keyboard.type("su");
    const popup = picker(page, "task_section_icon_picker");
    await expect(popup.getByRole("option")).toHaveCount(1);
    await expect(popup.getByRole("option")).toHaveAccessibleName("Sun");
    await expect(popup.getByRole("tab")).toHaveCount(0);
    await page.keyboard.press("Enter");
    await expectPosted(page, "section_icon", "sun");
  });

  test("Escape clears the search first, then closes", async ({ page }) => {
    await openPage(page);
    const icon = field(page, "task_page_icon_picker");
    await icon.click();
    await page.keyboard.type("cat");
    await page.keyboard.press("Escape");
    const search = picker(page, "task_page_icon_picker").getByRole("combobox", { name: "Search emoji…" });
    await expect(search).toHaveValue("");
    await expect(icon).toHaveAttribute("aria-expanded", "true");
    await page.keyboard.press("Escape");
    await expect(icon).toHaveAttribute("aria-expanded", "false");
    await expect(icon).toBeFocused();
  });
});
