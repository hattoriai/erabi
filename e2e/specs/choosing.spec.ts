import { expect, test, type Browser, type Page } from "@playwright/test";
import { openPage } from "./support";

// Who is choosing (Erabi.Issho): two people on one picker, and an agent.
async function person(browser: Browser, name: string): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await openPage(page, `/choosing?user=${name}`);
  return page;
}

test.describe("choosing together", () => {
  // One room for the page: one test at a time in it.
  test.describe.configure({ mode: "serial" });

  test("the others see who has the list open, and the option they are on", async ({ browser }) => {
    const ada = await person(browser, "ada");
    const ken = await person(browser, "ken");

    const kenField = ken.locator("#status_picker .erabi-field");
    await kenField.click();
    await ken.keyboard.press("ArrowDown");
    const kenActive = (await ken.locator("#status_picker [role=listbox] .erabi-active .erabi-label").textContent())!;

    const adaField = ada.locator("#status_picker .erabi-field");
    await expect(adaField).toHaveClass(/erabi-peer-open/);
    await expect(adaField.locator(".erabi-peers .erabi-peer")).toHaveAttribute("title", "Ken");
    await expect(adaField).toHaveAttribute("title", "Ken is choosing");
    const peek = ada.locator("#status_picker .erabi-peek");
    await expect(peek).toBeVisible();
    await expect(peek).toHaveAttribute("aria-hidden", "true");
    await expect(peek.locator(".erabi-active .erabi-label")).toHaveText(kenActive);

    // Issho's pointers find Ken's option on Ada's screen.
    const box = await ada.evaluate((option) => {
      const el = document.getElementById("status_picker") as unknown as Record<symbol, (at: unknown) => DOMRect | null>;
      const rect = el[Symbol.for("issho.locator")]!({ open: true, option });
      return rect && { top: rect.top, height: rect.height };
    }, await ken.locator("#status_picker [role=listbox] .erabi-active").getAttribute("data-value"));
    const row = await peek.locator(".erabi-active").boundingBox();
    expect(Math.round(box!.top)).toBe(Math.round(row!.y));

    // Ada opens her own list: Ken's option is marked in it.
    await adaField.click();
    await expect(peek).toBeHidden();
    await expect(ada.locator("#status_picker [role=listbox] .erabi-option", { hasText: kenActive }).locator(".erabi-peer")).toBeVisible();

    await ken.keyboard.press("Escape");
    await ada.keyboard.press("Escape");
    await expect(adaField).not.toHaveClass(/erabi-peer-open/);
  });

  test("an agent goes through the options before the value lands", async ({ browser }) => {
    const ada = await person(browser, "ada");
    const before = await ada.locator("#status-value").textContent();
    await ada.getByRole("button", { name: "Let Claude choose" }).click();

    const field = ada.locator("#status_picker .erabi-field");
    await expect(field.locator('.erabi-peers .erabi-peer[data-kind="agent"]')).toHaveAttribute("title", "Claude");
    await expect(ada.locator("#status_picker .erabi-peek .erabi-active")).toBeVisible();
    await expect(ada.locator("#status-value")).not.toHaveText(before!);
    await expect(field.locator(".erabi-peers .erabi-peer")).toHaveCount(0);
    await expect(ada.locator("#status_picker .erabi-peek")).toBeHidden();
  });
});
