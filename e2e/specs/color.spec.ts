import { expect, test } from "@playwright/test";
import { expectPosted, field, openPage, picker } from "./support";

// The color picker: a palette's swatches by name, and any color as
// #rrggbb with `custom`.
test.describe("color", () => {
  test("swatches are a listbox the arrows move in; Enter takes one, by name", async ({ page }) => {
    await openPage(page);
    const color = field(page, "task_color_picker");
    await color.focus();
    await page.keyboard.press("Enter");
    await expect(color).toHaveAttribute("aria-expanded", "true");
    const dialog = picker(page, "task_color_picker").getByRole("dialog");
    await expect(dialog.getByRole("option")).toHaveCount(9);
    await expect(dialog.getByRole("option").first()).toBeFocused();
    await page.keyboard.press("End");
    await expect(dialog.getByRole("option", { name: "Red" })).toBeFocused();
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("Enter");
    await expectPosted(page, "color", "pink");
    await expect(color).toBeFocused();
    await expect(color).toContainText("Pink");
    // Without `custom`, there is no custom color.
    await expect(picker(page, "task_color_picker").locator(".erabi-area")).toHaveCount(0);
  });

  test("a custom color, from the area, the hue and the hex box, posts as #rrggbb", async ({ page }) => {
    await openPage(page);
    const brand = field(page, "task_brand_picker");
    await brand.click();
    const area = picker(page, "task_brand_picker").getByRole("slider", { name: "Lightness and chroma" });
    const box = (await area.boundingBox())!;
    await page.mouse.click(box.x + box.width * 0.8, box.y + box.height * 0.4);
    await expectPosted(page, "brand", expect.stringMatching(/^#[0-9a-f]{6}$/));
    await expect(area).toHaveAttribute("aria-valuenow", "60");

    // The hue, with the keyboard.
    const hue = picker(page, "task_brand_picker").getByRole("slider", { name: "Hue" });
    const before = Number(await hue.getAttribute("aria-valuenow"));
    await hue.focus();
    await page.keyboard.press("Shift+ArrowRight");
    await expect(hue).toHaveAttribute("aria-valuenow", String((before + 10) % 360));

    // A hex, typed.
    const hex = picker(page, "task_brand_picker").getByRole("textbox", { name: "Hex" });
    await hex.fill("#3F6F8F");
    await hex.press("Enter");
    await expectPosted(page, "brand", "#3f6f8f");
    await expect(brand).toContainText("#3f6f8f");
    await expect(brand).toBeFocused();

    // Its contrast with the background it is for.
    await brand.click();
    await expect(picker(page, "task_brand_picker").locator(".erabi-ratio")).toHaveText(/^5\.\d:1 on #ffffff, AA$/);

    // Not a color: said, and nothing changes.
    await hex.fill("teal");
    await hex.press("Enter");
    await expect(hex).toHaveAttribute("aria-invalid", "true");
    await expectPosted(page, "brand", "#3f6f8f");

    // And the color is among the recent ones, next time.
    await page.keyboard.press("Escape");
    await brand.click();
    await expect(picker(page, "task_brand_picker").getByRole("group", { name: "Recent colors" }).getByRole("button", { name: "#3f6f8f" })).toBeVisible();
  });
});
