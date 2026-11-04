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
  // Notion's page icon: Emoji, Icons, and the app's Upload; Remove at the top.
  test("an app's tab shows its own content in place of the grid; its buttons and an action go to the LiveView", async ({ page }) => {
    await openPage(page);
    const popup = picker(page, "task_page_icon_picker");
    await field(page, "task_page_icon_picker").click();
    const tabs = popup.getByRole("tablist");
    await expect(tabs.getByRole("tab")).toHaveText(["Emoji", "Icons", "Upload"]);

    // The Upload tab: its content, no search or grid.
    await tabs.getByRole("tab", { name: "Upload" }).click();
    const panel = popup.getByRole("tabpanel", { name: "Upload" });
    await expect(panel).toBeVisible();
    await expect(popup.getByRole("combobox", { name: "Search emoji…" })).toBeHidden();
    await expect(popup.getByRole("listbox")).toBeHidden();

    // Its label opens the app's file input, outside the picker.
    const chooser = page.waitForEvent("filechooser");
    await panel.getByText("Upload an image").click();
    await chooser;

    // The popup stays for it; its button goes to the LiveView.
    await expect(panel).toBeVisible();
    await panel.getByRole("button", { name: "Use a link" }).click();
    await expect(page.locator("#picked")).toHaveText('"from the tab"');

    // The keys go from tab to tab, round.
    await tabs.getByRole("tab", { name: "Upload" }).focus();
    await page.keyboard.press("ArrowRight");
    await expect(tabs.getByRole("tab", { name: "Emoji" })).toHaveAttribute("aria-selected", "true");
    await expect(popup.getByRole("combobox", { name: "Search emoji…" })).toBeVisible();
    await page.keyboard.press("ArrowLeft");
    await expect(tabs.getByRole("tab", { name: "Upload" })).toHaveAttribute("aria-selected", "true");

    // Closed and opened again, it is on its first tab.
    await page.keyboard.press("Escape");
    await field(page, "task_page_icon_picker").click();
    await expect(tabs.getByRole("tab", { name: "Emoji" })).toHaveAttribute("aria-selected", "true");

    // An action goes to the LiveView, and closes the popup.
    await popup.getByRole("button", { name: "Remove" }).click();
    await expect(page.locator("#picked")).toHaveText('"removed"');
    await expect(popup.locator(".erabi-emoji-popup")).toBeHidden();
  });

  test("a picker of icons alone, with no tab of the app's, has no tabs", async ({ page }) => {
    await openPage(page);
    await field(page, "task_section_icon_picker").click();
    await expect(picker(page, "task_section_icon_picker").getByRole("tablist")).toHaveCount(0);
  });
});
