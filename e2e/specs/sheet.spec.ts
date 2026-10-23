import { devices, expect, test } from "@playwright/test";
import { expectPosted, openPage, picker } from "./support";

// On a phone, a picker's popup is a sheet from the bottom of the screen.
const { defaultBrowserType: _browser, ...phone } = devices["iPhone 13"];

test.describe("sheets on a phone", () => {
  test.use(phone);
  // Playwright emulates a phone (isMobile) in Chromium and WebKit, not in Firefox.
  test.skip(({ browserName }) => browserName === "firefox", "Playwright cannot emulate a phone in Firefox");

  test("a select is a sheet with its name and Done; a tap on a row chooses", async ({ page }) => {
    await openPage(page);
    await picker(page, "task_status_picker").locator(".erabi-chevron").tap();
    const sheet = picker(page, "task_status_picker").locator(".erabi-popup");
    await expect(sheet).toHaveClass(/erabi-sheet/);
    await expect(sheet.locator(".erabi-sheet-title")).toHaveText("Status");
    await expect(sheet.getByRole("button", { name: "Done" })).toBeVisible();
    const box = (await sheet.boundingBox())!;
    expect(box.x).toBe(0);
    expect(Math.round(box.y + box.height)).toBe(page.viewportSize()!.height);
    expect(await page.evaluate(() => document.documentElement.style.overflow)).toBe("hidden");

    await sheet.getByRole("option", { name: "Done" }).tap();
    await expectPosted(page, "status", "done");
    await expect(sheet).toBeHidden();
    expect(await page.evaluate(() => document.documentElement.style.overflow)).toBe("");
  });

  test("a tap on the dimmed page, Done, or a swipe down closes it", async ({ page }) => {
    await openPage(page);
    const chevron = picker(page, "task_labels_picker").locator(".erabi-chevron");
    const sheet = picker(page, "task_labels_picker").locator(".erabi-popup");

    await chevron.tap();
    await expect(sheet).toBeVisible();
    await page.touchscreen.tap(200, 40);
    await expect(sheet).toBeHidden();

    await chevron.tap();
    await sheet.getByRole("button", { name: "Done" }).tap();
    await expect(sheet).toBeHidden();

    await chevron.tap();
    // Where the handle stays, once the sheet has slid in.
    await sheet.evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));
    const head = (await sheet.locator(".erabi-sheet-handle").boundingBox())!;
    await page.mouse.move(head.x + head.width / 2, head.y + 2);
    await page.mouse.down();
    await page.mouse.move(head.x + head.width / 2, head.y + 400, { steps: 8 });
    await page.mouse.up();
    await expect(sheet).toBeHidden();
  });

  test("a combobox's box goes into the sheet as people type, and back", async ({ page }) => {
    await openPage(page);
    const input = picker(page, "task_city_picker").locator(".erabi-input");
    await input.tap();
    const sheet = picker(page, "task_city_picker").locator(".erabi-popup");
    await expect(sheet.locator(".erabi-sheet-slot .erabi-input")).toBeFocused();
    await page.keyboard.type("lis");
    await sheet.getByRole("option", { name: "Lisbon" }).tap();
    await expectPosted(page, "city", "Lisbon");
    await expect(sheet).toBeHidden();
    await expect(picker(page, "task_city_picker").locator(".erabi-field .erabi-input")).toHaveValue("Lisbon");

    // Typed and closed with Done: the text that is no option goes, as a focus that leaves.
    await input.tap();
    await page.keyboard.type("zz");
    await sheet.getByRole("button", { name: "Done" }).tap();
    await expect(sheet).toBeHidden();
    await expect(picker(page, "task_city_picker").locator(".erabi-field .erabi-input")).toHaveValue("Lisbon");
  });

  test("an emoji picker is a sheet too", async ({ page }) => {
    await openPage(page);
    await picker(page, "task_page_icon_picker").locator(".erabi-field").tap();
    const sheet = picker(page, "task_page_icon_picker").locator(".erabi-popup");
    await expect(sheet).toHaveClass(/erabi-sheet/);
    // The keyboard put away (WebKit also takes the focus on a tap): the sheet stays.
    await expect(sheet.getByRole("option", { name: "grinning face", exact: true })).toBeVisible();
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await expect(sheet).toBeVisible();
    await sheet.getByRole("option", { name: "grinning face", exact: true }).tap();
    await expectPosted(page, "page_icon", "😀");
  });
});

test("on a computer, the popup is under its field", async ({ page }) => {
  await openPage(page);
  await picker(page, "task_status_picker").locator(".erabi-field").click();
  const popup = picker(page, "task_status_picker").locator(".erabi-popup");
  await expect(popup).not.toHaveClass(/erabi-sheet/);
  await expect(popup.locator(".erabi-sheet-head")).toHaveCount(0);
});
