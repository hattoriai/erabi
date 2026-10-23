import { expect, test } from "@playwright/test";
import { openPage } from "./support";

// A grid's cell editor (Masu's contract): the editor draws in a box, and
// says what to save with commit; Escape is the picker's first.
test.describe("cell editors", () => {
  test.beforeEach(async ({ page }) => {
    await openPage(page);
    await page.evaluate(async () => {
      const { erabiEditors } = (await import("erabi")) as { erabiEditors: () => Record<string, (context: unknown) => unknown> };
      const box = Object.assign(document.createElement("div"), { id: "cell" });
      box.style.width = "240px";
      document.body.prepend(box);
      const w = window as unknown as Record<string, unknown>;
      w.commits = [];
      w.open = (name: string, value: unknown, options: Record<string, unknown>) => {
        box.replaceChildren();
        w.editor = erabiEditors()[name]!({
          element: box,
          value,
          text: null,
          options,
          label: "Labels",
          locale: "en",
          commit: (v: unknown) => (w.commits as unknown[]).push(v),
          cancel: () => (w.commits as unknown[]).push("cancelled"),
        });
      };
    });
  });

  test("a select saves the value as it is chosen", async ({ page }) => {
    await page.evaluate(() => (window as unknown as { open: Function }).open("erabi_select", "todo", { options: [{ v: "todo", l: "To do" }, { v: "done", l: "Done", c: "green" }] }));
    const list = page.locator("#cell [role=listbox]");
    await expect(list).toBeVisible();
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    expect(await page.evaluate(() => (window as unknown as { commits: unknown[] }).commits)).toEqual(["done"]);
  });

  test("a multi-select's value is what the grid saves; its Escape closes the list first", async ({ page }) => {
    await page.evaluate(() =>
      (window as unknown as { open: Function }).open("erabi_multi_select", ["bug"], { options: [{ v: "bug", l: "Bug" }, { v: "docs", l: "Docs" }], rules: { max: 2 } }),
    );
    await page.locator("#cell [role=option]", { hasText: "Docs" }).click();
    expect(await page.evaluate(() => (window as unknown as { editor: { value: () => unknown } }).editor.value())).toEqual(["bug", "docs"]);

    await page.keyboard.press("Escape");
    await expect(page.locator("#cell [role=listbox]")).toBeHidden();
    expect(await page.evaluate(() => (window as unknown as { commits: unknown[] }).commits)).toEqual([]);
  });

  test("the popup is the editor's own, for the grid", async ({ page }) => {
    await page.evaluate(() => (window as unknown as { open: Function }).open("erabi_select", null, { options: [{ v: "a", l: "A" }] }));
    const own = await page.evaluate(() => {
      const w = window as unknown as { editor: { contains: (n: Node) => boolean } };
      const option = document.querySelector("#cell [role=option]")!;
      return [w.editor.contains(option), w.editor.contains(document.body)];
    });
    expect(own).toEqual([true, false]);
  });
});
