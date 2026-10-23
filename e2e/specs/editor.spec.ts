import { expect, test, type Page } from "@playwright/test";
import { openPage } from "./support";

type Opener = { open: (name: string, value: unknown, options: Record<string, unknown>, text?: string) => void };
type Commits = { commits: unknown[] };

/** A cell's box on the page, and `open` to draw an editor of the given name in it. */
async function grid(page: Page, path = "/"): Promise<void> {
  await openPage(page, path);
  await page.evaluate(async () => {
    const { erabiEditors } = (await import("erabi")) as { erabiEditors: () => Record<string, (context: unknown) => unknown> };
    const box = Object.assign(document.createElement("div"), { id: "cell" });
    box.style.width = "240px";
    document.body.prepend(box);
    const w = window as unknown as Record<string, unknown>;
    w.commits = [];
    w.open = (name: string, value: unknown, options: Record<string, unknown>, text: string | null = null) => {
      box.replaceChildren();
      w.editor = erabiEditors()[name]!({
        element: box,
        value,
        text,
        options,
        label: "Labels",
        locale: "en",
        commit: (v: unknown) => (w.commits as unknown[]).push(v),
        cancel: () => (w.commits as unknown[]).push("cancelled"),
      });
    };
  });
}

const PALETTE = [
  { v: "red", l: "Red", c: "red" },
  { v: "green", l: "Green", c: "green" },
  { v: "blue", l: "Blue", c: "blue" },
];
const CUSTOM = { create: true, pattern: "#[0-9a-fA-F]{6}" };

// A grid's cell editor (Masu's contract): the editor draws in a box, and
// says what to save with commit; Escape is the picker's first.
test.describe("cell editors", () => {
  test.beforeEach(async ({ page }) => grid(page));

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

test.describe("color cell editors", () => {
  test.beforeEach(async ({ page }) => grid(page));

  test("a swatch is saved as it is chosen", async ({ page }) => {
    await page.evaluate((options) => (window as unknown as Opener).open("erabi_color", "red", options), { options: PALETTE });
    const dialog = page.locator("#cell [role=dialog]");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("option", { name: "Red" })).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Enter");
    expect(await page.evaluate(() => (window as unknown as Commits).commits)).toEqual(["green"]);
  });

  test("a drag in the area saves once, as the popup closes; Escape with no change cancels", async ({ page }) => {
    await page.evaluate(([options, rules]) => (window as unknown as Opener).open("erabi_color", null, { options, rules }), [PALETTE, CUSTOM] as const);
    const area = page.locator("#cell .erabi-area");
    const box = (await area.boundingBox())!;
    await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.5);
    await page.mouse.down();
    for (const x of [0.4, 0.6, 0.8]) await page.mouse.move(box.x + box.width * x, box.y + box.height * 0.5, { steps: 4 });
    await page.mouse.up();
    await page.waitForTimeout(400);
    expect(await page.evaluate(() => (window as unknown as Commits).commits)).toEqual([]);
    await page.keyboard.press("Enter");
    const commits = await page.evaluate(() => (window as unknown as Commits).commits);
    expect(commits).toHaveLength(1);
    expect(commits[0]).toMatch(/^#[0-9a-f]{6}$/);

    await page.evaluate((options) => (window as unknown as Opener).open("erabi_color", "red", options), { options: PALETTE });
    await expect(page.locator("#cell [role=dialog]")).toBeVisible();
    await page.keyboard.press("Escape");
    expect(await page.evaluate(() => (window as unknown as Commits).commits)).toEqual([commits[0], "cancelled"]);
  });

  test("what a person types on the cell goes to the hex box", async ({ page }) => {
    await page.evaluate(([options, rules]) => (window as unknown as Opener).open("erabi_color", null, { options, rules }, "3f"), [PALETTE, CUSTOM] as const);
    const hex = page.locator("#cell").getByRole("textbox", { name: "Hex" });
    await expect(hex).toBeFocused();
    await expect(hex).toHaveValue("#3f");
    await page.keyboard.type("6f8f");
    await page.keyboard.press("Enter");
    expect(await page.evaluate(() => (window as unknown as Commits).commits)).toEqual(["#3f6f8f"]);
  });
});

test.describe("without erabi/color", () => {
  test("a color picker stays the browser's <select>, and says the import it needs", async ({ page }) => {
    const warnings: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "warning") warnings.push(message.text());
    });
    await openPage(page, "/?nocolor");
    const native = page.locator("#task_color");
    await expect(native).toBeVisible();
    await native.selectOption("green");
    expect(warnings.some((w) => w.includes('import "erabi/color"'))).toBe(true);
  });

  test("a color column is a select of its palette", async ({ page }) => {
    await grid(page, "/?nocolor");
    await page.evaluate((options) => (window as unknown as Opener).open("erabi_color", "red", options), { options: PALETTE });
    await expect(page.locator("#cell [role=listbox]")).toBeVisible();
    await page.locator("#cell [role=option]", { hasText: "Blue" }).click();
    expect(await page.evaluate(() => (window as unknown as Commits).commits)).toEqual(["blue"]);
  });
});

