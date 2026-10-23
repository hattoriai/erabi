// The emoji and icon pickers: a grid of every emoji, by category, with a
// search in the page's language (names, tags and :shortcodes:), skin
// tones, recent emoji, and a preview of the one under the pointer or the
// keyboard; and a tab of the app's icons, or the icons alone (`icon`).
// It posts the emoji itself ("🎉"), or an icon's value, in its native
// control, as the other pickers do.
//
// The emoji come from a file of the page's language (Erabi.Emoji serves
// it), fetched the first time a picker opens, and kept by the browser.
// Emoji newer than the device draws are left out.

import { internal } from "erabi";
import type { Config, Option, Words } from "./config";
import type { AnyPicker } from "./kinds";
import type { Matchable } from "./match";
import type { Transport } from "./picker";
import type { Popup } from "./popup";
import { foldEmoji, searchEmoji, type Folded } from "./emojisearch";

const { option, readConfig, readValue, el, icon, writeNative, rank } = internal;

const RECENT_KEY = "erabi-emoji-recent";
const TONE_KEY = "erabi-emoji-tone";
const RECENT_MAX = 18;
const RESULTS_MAX = 240;
const SVG = "http://www.w3.org/2000/svg";

/** An emoji of the data. */
interface Emoji {
  char: string;
  label: string;
  keywords: string[];
  group: number;
  version: number;
  /** The five skin tones, light to dark, or none. */
  tones: string[] | null;
  /** GitHub's shortcode, or "". */
  code: string;
  /** Its name and keywords, folded for the search. */
  folded: Folded;
}

interface EmojiData {
  groups: (string | null)[];
  tones: string[];
  emoji: Emoji[];
  /** Each emoji and each of its tones, by its text. */
  byChar: Map<string, Emoji>;
}

type Row = [string, string, string[], number, number, string[] | 0, string];

/** A cell of the grid: an emoji (in the person's tone) or one of the app's icons. */
interface Cell extends Matchable {
  value: string;
  label: string;
  keywords: string[];
  emoji?: Emoji;
  icon?: Option;
}

const loads = new Map<string, Promise<EmojiData>>();

/** The emoji data at a URL, fetched once a page. */
function load(url: string): Promise<EmojiData> {
  let loading = loads.get(url);
  if (!loading) {
    loading = fetch(url, { credentials: "same-origin" })
      .then((response) => {
        if (!response.ok) throw new Error(`Erabi: the emoji did not load from ${url} (${response.status})`);
        return response.json() as Promise<{ groups: (string | null)[]; tones: string[]; emoji: Row[] }>;
      })
      .then((data) => {
        const emoji = data.emoji.map(([char, label, keywords, group, version, tones, code]) => ({ char, label, keywords, group, version, tones: tones || null, code, folded: foldEmoji({ label, keywords, code }) }));
        const byChar = new Map<string, Emoji>();
        for (const e of emoji) {
          byChar.set(e.char, e);
          for (const tone of e.tones ?? []) byChar.set(tone, e);
        }
        return { groups: data.groups, tones: data.tones, emoji, byChar };
      });
    loading.catch(() => loads.delete(url));
    loads.set(url, loading);
  }
  return loading;
}

// -- Which emoji the device draws ---------------------------------------------

let drawable: number | null = null;

/**
 * The newest Unicode emoji version the device draws, from the first emoji
 * of each version after 11 (which every current system has): an emoji it
 * draws is one glyph, in color. Infinity when it cannot tell (no canvas, or
 * no color emoji at all, where nothing would be left).
 */
function drawableVersion(emoji: Emoji[]): number {
  if (drawable !== null) return drawable;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 32;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return (drawable = Infinity);
  ctx.font = "24px 'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif";
  ctx.textBaseline = "top";
  const unit = ctx.measureText("😀").width;
  const draws = (char: string): boolean => {
    if (ctx.measureText(char).width > unit * 1.5) return false;
    ctx.clearRect(0, 0, 32, 32);
    ctx.fillStyle = "#ff0000";
    ctx.fillText(char, 0, 0);
    const pixels = ctx.getImageData(0, 0, 32, 32).data;
    // A color glyph does not take the fill; a missing one is drawn in it.
    for (let i = 0; i < pixels.length; i += 4) {
      if (pixels[i + 3]! > 64 && (pixels[i + 1]! > 48 || pixels[i + 2]! > 48)) return true;
    }
    return false;
  };
  if (!draws("😀")) return (drawable = Infinity);
  const versions = [...new Set(emoji.map((e) => e.version))].filter((v) => v > 11).sort((a, b) => a - b);
  drawable = 11;
  for (const version of versions) {
    const probe = emoji.find((e) => e.version === version);
    if (!probe || !draws(probe.char)) break;
    drawable = version;
  }
  return drawable;
}

// -- Icons of the categories (Lucide, ISC: see NOTICE) -------------------------

const circle = (cx: number, cy: number, r: number) => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;

const GROUP_ICONS: Record<string, string[]> = {
  /** Lucide `clock`. */
  recent: [circle(12, 12, 10), "M12 6v6l4 2"],
  /** Lucide `smile`. */
  0: ["M15 10V9", "M16.472 15a6 6 0 01-8.943 0", "M9 10V9", circle(12, 12, 10)],
  /** Lucide `hand`. */
  1: ["M18 11V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2", "M14 10V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v2", "M10 10.5V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2v8", "M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"],
  /** Lucide `cat`. */
  3: ["M12 5c.67 0 1.35.09 2 .26 1.78-2 5.03-2.84 6.42-2.26 1.4.58-.42 7-.42 7 .57 1.07 1 2.24 1 3.44C21 17.9 16.97 21 12 21s-9-3-9-7.56c0-1.25.5-2.4 1-3.44 0 0-1.89-6.42-.5-7 1.39-.58 4.72.23 6.5 2.23A9.04 9.04 0 0 1 12 5Z", "M8 14v.5", "M16 14v.5", "M11.25 16.25h1.5L12 17l-.75-.75Z"],
  /** Lucide `apple`. */
  4: ["M12 6.528V3a1 1 0 0 1 1-1h0", "M18.237 21A15 15 0 0 0 22 11a6 6 0 0 0-10-4.472A6 6 0 0 0 2 11a15.1 15.1 0 0 0 3.763 10 3 3 0 0 0 3.648.648 5.5 5.5 0 0 1 5.178 0A3 3 0 0 0 18.237 21"],
  /** Lucide `car`. */
  5: ["M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2", circle(7, 17, 2), "M9 17h6", circle(17, 17, 2)],
  /** Lucide `volleyball`. */
  6: ["M11 7a16 16 20 0 1 10.98 4.362", "M12 12a13 13 0 0 1-8.66 5", "M16.83 13.634a16 16 0 0 1-9.267 7.328", "M20.66 17A13 13 0 0 0 12 12a13 13 0 0 1 0-10", "M8.17 15.366a16 16 0 0 1-1.713-11.69", circle(12, 12, 10)],
  /** Lucide `lightbulb`. */
  7: ["M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5", "M9 18h6", "M10 22h4"],
  /** Lucide `heart`. */
  8: ["M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5"],
  /** Lucide `flag`. */
  9: ["M4 22V4a1 1 0 0 1 .4-.8A6 6 0 0 1 8 2c3 0 5 2 7.333 2q2 0 3.067-.8A1 1 0 0 1 20 4v10a1 1 0 0 1-.4.8A6 6 0 0 1 16 16c-3 0-5-2-8-2a6 6 0 0 0-4 1.528"],
};

function svgIcon(paths: string[]): SVGSVGElement {
  const svg = document.createElementNS(SVG, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("class", "erabi-icon");
  for (const d of paths) {
    const path = document.createElementNS(SVG, "path");
    path.setAttribute("d", d);
    svg.append(path);
  }
  return svg;
}

/** "smileys & emotion" as a heading: "Smileys & emotion". */
function heading(text: string, locale: string): string {
  return text.charAt(0).toLocaleUpperCase(locale) + text.slice(1);
}

function stored<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

function store(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // No storage (a private window): nothing is kept.
  }
}

export class EmojiPicker implements AnyPicker {
  readonly id: string;
  private el: HTMLElement;
  private transport: Transport | null;
  private config: Config;
  private words: Words;
  private native: HTMLSelectElement | HTMLInputElement | null;
  private options: Option[] = [];
  private value: string | null = null;
  private serverValue: string;
  private data: EmojiData | null = null;
  private failed = false;
  private tab: "emoji" | "icons";
  private tone: number = stored(TONE_KEY, 0);
  private cells: Cell[] = [];
  private active = -1;
  private query = "";
  private field!: HTMLElement;
  private shown!: HTMLElement;
  private popup!: Popup;
  private input!: HTMLInputElement;
  private list!: HTMLElement;
  private nav!: HTMLElement;
  private tabs: HTMLElement | null = null;
  private toneButton: HTMLButtonElement | null = null;
  private toneMenu: HTMLElement | null = null;
  private preview!: HTMLElement;
  private live!: HTMLElement;
  private cleanups: (() => void)[] = [];

  constructor(el: HTMLElement, transport: Transport | null) {
    this.el = el;
    this.transport = transport;
    this.config = readConfig(el);
    this.id = this.config.id ?? el.id;
    this.words = new internal.Words(this.config.messages ?? {}, this.config.locale ?? "en");
    this.native = el.querySelector<HTMLSelectElement | HTMLInputElement>('[data-part="value"]');
    this.options = [...(this.config.options ?? []), ...(this.config.selected ?? [])].map(option);
    this.value = readValue(el)[0] ?? null;
    this.serverValue = el.dataset.value ?? "[]";
    this.tab = this.hasEmoji ? "emoji" : "icons";
    this.build();
    this.render();
    if (this.native) {
      this.native.setAttribute("aria-hidden", "true");
      this.native.tabIndex = -1;
    }
    el.classList.add("erabi-ready");
  }

  private get hasEmoji(): boolean {
    return this.config.kind === "emoji";
  }

  /** The app's icons: the options that have one. */
  private get icons(): Option[] {
    return this.config.icons ? this.options.filter((o) => o.icon) : [];
  }

  private get inactive(): boolean {
    return !!this.config.disabled || !!this.config.readonly;
  }

  // -- Building -----------------------------------------------------------

  private build(): void {
    const config = this.config;
    const label = !config.labelId && this.native?.labels?.[0] ? this.native.labels[0] : null;
    if (label) {
      label.id ||= `${this.id}-label`;
      config.labelId = label.id;
      label.addEventListener("click", (event) => {
        event.preventDefault();
        this.field.focus();
      });
    }

    this.shown = el("span", { class: "erabi-values" });
    this.field = el("div", {
      class: "erabi-field",
      "data-kind": config.kind,
      role: "combobox",
      tabindex: config.disabled ? "-1" : "0",
      "aria-haspopup": "dialog",
      "aria-expanded": "false",
      "aria-controls": `${this.id}-dialog`,
      "aria-labelledby": config.labelId ?? null,
      "aria-label": config.labelId ? null : (config.label ?? null),
      "aria-describedby": config.describedBy ?? null,
      "aria-invalid": config.invalid ? "true" : null,
      "aria-disabled": config.disabled ? "true" : null,
      "aria-readonly": config.readonly ? "true" : null,
    });
    this.field.append(this.shown);
    if (config.clearable) {
      const clear = el("button", { type: "button", class: "erabi-clear", tabindex: "-1", "aria-label": this.words.t("clear") }, icon("close"));
      clear.addEventListener("click", (event) => {
        event.stopPropagation();
        this.commit(null);
      });
      this.field.append(clear);
    }
    this.field.append(el("span", { class: "erabi-chevron", "aria-hidden": "true" }, icon("chevron")));

    const listId = `${this.id}-grid`;
    this.input = el("input", {
      type: "text",
      class: "erabi-filter",
      role: "combobox",
      "aria-autocomplete": "list",
      "aria-expanded": "true",
      "aria-controls": listId,
      "aria-label": this.words.t(this.hasEmoji ? "searchEmoji" : "search"),
      placeholder: this.words.t(this.hasEmoji ? "searchEmoji" : "search"),
      autocomplete: "off",
      spellcheck: "false",
    });
    const search = el("div", { class: "erabi-filter-box" }, icon("search"), this.input);
    const head = el("div", { class: "erabi-emoji-head" });
    if (this.hasEmoji && this.icons.length > 0) {
      this.tabs = el("div", { class: "erabi-tabs", role: "tablist" });
      for (const [tab, word] of [
        ["emoji", "emoji"],
        ["icons", "icons"],
      ] as const) {
        const button = el("button", { type: "button", role: "tab", class: "erabi-tab", "data-tab": tab, "aria-selected": String(tab === this.tab), tabindex: tab === this.tab ? "0" : "-1" }, this.words.t(word));
        this.tabs.append(button);
      }
      head.append(this.tabs);
    }
    head.append(search);
    if (this.hasEmoji && !config.noTones) {
      this.toneButton = el("button", { type: "button", class: "erabi-tone", "aria-haspopup": "true", "aria-expanded": "false", "aria-label": this.words.t("skinTone") });
      this.toneMenu = el("div", { class: "erabi-tone-menu", role: "radiogroup", "aria-label": this.words.t("skinTone"), hidden: "" });
      search.append(this.toneButton);
      head.append(this.toneMenu);
    }

    this.nav = el("div", { class: "erabi-emoji-nav", role: "toolbar", "aria-label": this.words.t("categories") });
    this.list = el("div", { id: listId, class: "erabi-emoji-list", role: "listbox", "aria-label": config.label ?? this.words.t("emoji") });
    this.preview = el("div", { class: "erabi-emoji-preview", "aria-hidden": "true" });
    const body = el("div", { id: `${this.id}-dialog`, class: "erabi-popup-body erabi-emoji-popup", role: "dialog", "aria-label": config.label ?? this.words.t("emoji") }, head, this.nav, this.list, this.preview);
    this.popup = new internal.Popup(this.field, body, () => this.close(false), { width: 352, maxHeight: 460, ...internal.sheetOf(config, this.words) });

    this.live = el("div", { class: "erabi-live", "aria-live": "polite", "aria-atomic": "true" });
    this.el.append(this.field, body, this.live);
    this.listen();
  }

  private listen(): void {
    const on = <K extends keyof HTMLElementEventMap>(target: HTMLElement, type: K, handler: (event: HTMLElementEventMap[K]) => void) => {
      target.addEventListener(type, handler as EventListener);
      this.cleanups.push(() => target.removeEventListener(type, handler as EventListener));
    };
    on(this.field, "click", () => {
      if (this.inactive) return;
      if (this.popup.open) this.close(true);
      else this.open();
    });
    on(this.field, "keydown", (event) => {
      if (this.inactive) return;
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
        event.preventDefault();
        this.open();
      } else if ((event.key === "Backspace" || event.key === "Delete") && this.config.clearable && this.value) {
        event.preventDefault();
        this.commit(null);
      } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
        // A letter on the field starts a search.
        event.preventDefault();
        this.type(event.key);
      }
    });
    // The data comes as people get near the field, so that the list is there as it opens.
    const warm = () => {
      if (this.hasEmoji && this.config.emojiData) void load(this.config.emojiData).catch(() => {});
    };
    on(this.field, "pointerenter", warm);
    on(this.field, "focus", warm);
    on(this.input, "input", () => this.search(this.input.value));
    on(this.input, "keydown", (event) => this.key(event));
    on(this.list, "pointermove", (event) => {
      const cell = (event.target as Element).closest<HTMLElement>("[data-index]");
      if (cell) this.setActive(Number(cell.dataset.index), false);
    });
    // A press in the grid keeps the focus in the search, where the keys go.
    on(this.list, "pointerdown", (event) => event.preventDefault());
    on(this.preview, "pointerdown", (event) => event.preventDefault());
    on(this.list, "click", (event) => {
      const cell = (event.target as Element).closest<HTMLElement>("[data-index]");
      if (cell) this.choose(this.cells[Number(cell.dataset.index)]!);
    });
    on(this.list, "scroll", () => this.spy());
    on(this.nav, "click", (event) => {
      const button = (event.target as Element).closest<HTMLElement>("[data-section]");
      if (button) this.jump(button.dataset.section!);
    });
    if (this.tabs) {
      on(this.tabs, "click", (event) => {
        const button = (event.target as Element).closest<HTMLElement>("[data-tab]");
        if (button) {
          this.switchTab(button.dataset.tab as "emoji" | "icons");
          this.input.focus();
        }
      });
      on(this.tabs, "keydown", (event) => {
        if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
          event.preventDefault();
          this.switchTab(this.tab === "emoji" ? "icons" : "emoji");
          this.tabs!.querySelector<HTMLElement>('[aria-selected="true"]')?.focus();
        }
      });
    }
    if (this.toneButton && this.toneMenu) {
      on(this.toneButton, "click", () => this.toggleTones());
      on(this.toneMenu, "click", (event) => {
        const button = (event.target as Element).closest<HTMLElement>("[data-tone]");
        if (button) this.setTone(Number(button.dataset.tone));
      });
      on(this.toneMenu, "keydown", (event) => {
        const buttons = Array.from(this.toneMenu!.querySelectorAll<HTMLElement>("[data-tone]"));
        const index = buttons.indexOf(document.activeElement as HTMLElement);
        const step = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 0;
        if (step) {
          event.preventDefault();
          buttons[(index + step + buttons.length) % buttons.length]?.focus();
        }
      });
    }
    on(this.el, "keydown", (event) => {
      if (event.key !== "Escape" || !this.popup.open) return;
      event.preventDefault();
      event.stopPropagation();
      if (this.toneMenu && !this.toneMenu.hidden) this.toggleTones(false);
      else if (this.query) this.search("");
      else this.close(true);
    });
    on(this.el, "focusout", (event) => {
      const next = event.relatedTarget as Node | null;
      // A sheet stays as the focus goes (a phone's keyboard put away, a tap
      // in it): Done, the dimmed page, a swipe or a choice closes it.
      if ((next && this.el.contains(next)) || (this.popup.open && this.popup.sheet)) return;
      queueMicrotask(() => {
        if (!this.el.contains(document.activeElement)) this.close(false);
      });
    });
  }

  // -- Open and close -----------------------------------------------------

  open(): void {
    if (this.inactive || this.popup.open) return;
    this.input.value = this.query = "";
    this.popup.show();
    this.field.setAttribute("aria-expanded", "true");
    this.el.classList.add("erabi-open");
    this.renderTone();
    this.input.focus();
    if (this.hasEmoji && !this.data && this.config.emojiData) {
      this.list.replaceChildren(el("div", { class: "erabi-status" }, this.words.t("loading")));
      this.nav.replaceChildren();
      load(this.config.emojiData).then(
        (data) => {
          this.data = data;
          this.failed = false;
          this.render();
          if (this.popup.open) this.draw(true);
        },
        () => {
          this.failed = true;
          if (this.popup.open) this.draw(true);
        },
      );
    } else {
      this.draw(true);
    }
    this.popup.place();
  }

  close(restore: boolean): void {
    if (!this.popup.open) return;
    this.toggleTones(false);
    this.popup.hide();
    this.field.setAttribute("aria-expanded", "false");
    this.el.classList.remove("erabi-open");
    this.input.removeAttribute("aria-activedescendant");
    this.active = -1;
    if (restore) this.field.focus();
    this.el.dispatchEvent(new CustomEvent("erabi:closed", { detail: { id: this.id } }));
  }

  /** Starts with what a person typed (on the field, or on a grid's cell): a search. */
  type(text: string): void {
    this.open();
    this.input.value = text;
    this.input.focus();
    this.search(text);
  }

  // -- The grid -----------------------------------------------------------

  private switchTab(tab: "emoji" | "icons"): void {
    if (tab === this.tab) return;
    this.tab = tab;
    for (const button of this.tabs?.querySelectorAll<HTMLElement>("[data-tab]") ?? []) {
      const selected = button.dataset.tab === tab;
      button.setAttribute("aria-selected", String(selected));
      button.tabIndex = selected ? 0 : -1;
    }
    this.input.placeholder = this.words.t(tab === "emoji" ? "searchEmoji" : "search");
    this.input.setAttribute("aria-label", this.input.placeholder);
    if (this.toneButton) this.toneButton.hidden = tab !== "emoji";
    this.draw(true);
  }

  /** The emoji a device draws, in the person's tone. */
  private emojiCells(list: Emoji[]): Cell[] {
    return list.map((e) => ({ value: (this.tone > 0 && e.tones?.[this.tone - 1]) || e.char, label: e.label, keywords: e.keywords, emoji: e }));
  }

  private iconCells(): Cell[] {
    return this.icons.map((o) => ({ value: o.value, label: o.label, keywords: o.keywords ?? [], icon: o }));
  }

  private recentCells(): Cell[] {
    const recent = stored<string[]>(RECENT_KEY, []);
    const cells: Cell[] = [];
    for (const value of recent) {
      const e = this.data?.byChar.get(value);
      if (e) cells.push({ ...this.emojiCells([e])[0]!, value: e.tones && this.tone > 0 ? e.tones[this.tone - 1]! : e.char });
    }
    return cells.slice(0, RECENT_MAX);
  }

  /** Draws the grid: every emoji by category (or the icons), or the results of a search. */
  private draw(reset: boolean): void {
    const sections: { key: string; title: string; cells: Cell[] }[] = [];
    if (this.tab === "icons") {
      const cells = this.iconCells();
      sections.push({ key: "icons", title: this.words.t("icons"), cells: this.query ? rank(cells, this.query).map((r) => r.option) : cells });
    } else if (this.failed) {
      const retry = el("button", { type: "button", class: "erabi-retry" }, this.words.t("retry"));
      retry.addEventListener("click", () => {
        this.failed = false;
        this.close(false);
        this.open();
      });
      this.list.replaceChildren(el("div", { class: "erabi-status" }, this.words.t("loadFailed"), " ", retry));
      return;
    } else if (this.data) {
      const max = drawableVersion(this.data.emoji);
      const all = this.data.emoji.filter((e) => e.version <= max);
      if (this.query) {
        sections.push({ key: "results", title: this.words.t("results"), cells: this.emojiCells(searchEmoji(all, (e) => e.folded, this.query).slice(0, RESULTS_MAX)) });
      } else {
        const recent = this.recentCells();
        if (recent.length) sections.push({ key: "recent", title: this.words.t("recentEmoji"), cells: recent });
        this.data.groups.forEach((title, group) => {
          if (title === null) return;
          const cells = this.emojiCells(all.filter((e) => e.group === group));
          if (cells.length) sections.push({ key: String(group), title: heading(title, this.words.locale), cells });
        });
      }
    } else {
      return;
    }

    this.cells = sections.flatMap((s) => s.cells);
    let index = 0;
    const nodes = sections.map((section) => {
      const headingId = `${this.id}-s-${section.key}`;
      const grid = el("div", { class: "erabi-emoji-grid", role: "presentation" });
      for (const cell of section.cells) grid.append(this.cell(cell, index++));
      const node = el("div", { class: "erabi-emoji-section", role: "group", "aria-labelledby": headingId, "data-section": section.key }, el("div", { id: headingId, class: "erabi-emoji-heading" }, section.title), grid);
      // Off screen, a section is not laid out: its size is its rows'.
      node.style.setProperty("contain-intrinsic-size", `auto ${Math.ceil(section.cells.length / 9) * 36 + 30}px`);
      return node;
    });
    if (this.cells.length === 0) nodes.push(el("div", { class: "erabi-status" }, this.words.t("noMatches")) as HTMLDivElement);
    this.list.replaceChildren(...nodes);
    this.nav.hidden = this.tab !== "emoji" || !!this.query;
    if (!this.nav.hidden) {
      this.nav.replaceChildren(
        ...sections.map((s) =>
          el("button", { type: "button", class: "erabi-emoji-category", "data-section": s.key, "aria-label": s.title, title: s.title, tabindex: "-1" }, svgIcon(GROUP_ICONS[s.key] ?? GROUP_ICONS[0]!)),
        ),
      );
    }
    if (reset) this.list.scrollTop = 0;
    // The cells are new: none is active yet.
    this.active = -1;
    const chosen = this.value === null ? -1 : this.cells.findIndex((c) => c.value === this.value);
    this.setActive(this.query ? (this.cells.length ? 0 : -1) : chosen, !this.query && chosen >= 0);
    this.renderPreview();
    if (this.query) this.say(this.words.count("results", this.cells.length));
    this.spy();
  }

  private cell(cell: Cell, index: number): HTMLElement {
    const node = el("span", {
      id: `${this.id}-c${index}`,
      class: "erabi-emoji-cell",
      role: "option",
      "aria-label": cell.label,
      "aria-selected": String(cell.value === this.value),
      "data-index": String(index),
    });
    if (cell.icon) node.append(this.iconNode(cell.icon));
    else node.textContent = cell.value;
    return node;
  }

  private iconNode(o: Option): Node {
    const template = this.el.querySelector<HTMLTemplateElement>(`template[data-erabi-icon="${CSS.escape(o.icon ?? "")}"]`);
    return el("span", { class: "erabi-option-icon", "aria-hidden": "true" }, template ? template.content.cloneNode(true) : "");
  }

  private setActive(index: number, scroll: boolean): void {
    if (index === this.active && !scroll) return;
    this.list.querySelector(".erabi-active")?.classList.remove("erabi-active");
    this.active = index;
    const node = index >= 0 ? this.list.querySelector<HTMLElement>(`[data-index="${index}"]`) : null;
    if (node) {
      node.classList.add("erabi-active");
      this.input.setAttribute("aria-activedescendant", node.id);
      if (scroll) node.scrollIntoView({ block: "nearest" });
    } else {
      this.input.removeAttribute("aria-activedescendant");
    }
    this.renderPreview();
  }

  /** The cell next to the active one: in its row, or in the row above or below, nearest across. */
  private move(key: string): number {
    const count = this.cells.length;
    if (count === 0) return -1;
    if (this.active < 0) return 0;
    if (key === "ArrowRight") return Math.min(count - 1, this.active + 1);
    if (key === "ArrowLeft") return Math.max(0, this.active - 1);
    const nodes = Array.from(this.list.querySelectorAll<HTMLElement>("[data-index]"));
    const current = nodes[this.active];
    if (!current) return this.active;
    const top = current.offsetTop + (current.offsetParent === this.list ? 0 : (current.offsetParent as HTMLElement).offsetTop);
    const at = (node: HTMLElement) => node.offsetTop + (node.offsetParent === this.list ? 0 : (node.offsetParent as HTMLElement).offsetTop);
    const down = key === "ArrowDown";
    let row: HTMLElement[] = [];
    let rowTop: number | null = null;
    const ordered = down ? nodes.slice(this.active + 1) : nodes.slice(0, this.active).reverse();
    for (const node of ordered) {
      const y = at(node);
      if (down ? y <= top : y >= top) continue;
      if (rowTop === null) rowTop = y;
      if (y !== rowTop) break;
      row.push(node);
    }
    if (row.length === 0) return this.active;
    row = row.sort((a, b) => Math.abs(a.offsetLeft - current.offsetLeft) - Math.abs(b.offsetLeft - current.offsetLeft));
    return Number(row[0]!.dataset.index);
  }

  private key(event: KeyboardEvent): void {
    const grid = ["ArrowDown", "ArrowUp"].includes(event.key) || (["ArrowLeft", "ArrowRight"].includes(event.key) && this.active >= 0 && (this.query === "" || this.input.selectionStart === this.input.value.length));
    if (grid) {
      event.preventDefault();
      this.setActive(this.move(event.key), true);
    } else if (event.key === "Enter") {
      event.preventDefault();
      const cell = this.cells[this.active];
      if (cell) this.choose(cell);
    }
  }

  private search(query: string): void {
    this.query = query.trim();
    if (this.input.value !== query) this.input.value = query;
    this.draw(true);
  }

  private jump(key: string): void {
    const section = this.list.querySelector<HTMLElement>(`.erabi-emoji-section[data-section="${CSS.escape(key)}"]`);
    if (!section) return;
    this.list.scrollTop = section.offsetTop;
    const first = section.querySelector<HTMLElement>("[data-index]");
    if (first) this.setActive(Number(first.dataset.index), false);
    this.input.focus();
  }

  /** Marks the category of the section at the top of the list. */
  private spy(): void {
    if (this.nav.hidden) return;
    let current: string | null = null;
    for (const section of this.list.querySelectorAll<HTMLElement>(".erabi-emoji-section")) {
      if (section.offsetTop <= this.list.scrollTop + 8) current = section.dataset.section!;
      else break;
    }
    for (const button of this.nav.querySelectorAll<HTMLElement>("[data-section]")) {
      button.classList.toggle("erabi-current", button.dataset.section === (current ?? button.parentElement!.firstElementChild?.getAttribute("data-section")));
    }
  }

  // -- Skin tones ---------------------------------------------------------

  private toggleTones(show?: boolean): void {
    if (!this.toneMenu || !this.toneButton) return;
    const open = show ?? this.toneMenu.hidden;
    if (open) {
      const hand = "✋";
      const tones = ["", "🏻", "🏼", "🏽", "🏾", "🏿"];
      const names = [this.words.t("noTone"), ...(this.data?.tones ?? [])];
      this.toneMenu.replaceChildren(
        ...tones.map((mark, tone) =>
          el("button", { type: "button", role: "radio", class: "erabi-tone-option", "data-tone": String(tone), "aria-checked": String(tone === this.tone), "aria-label": names[tone] ?? "", title: names[tone] ?? "" }, hand + mark),
        ),
      );
      this.toneMenu.hidden = false;
      this.toneMenu.querySelector<HTMLElement>('[aria-checked="true"]')?.focus();
    } else {
      // Focus leaves the menu before it hides, or the picker would close.
      if (this.toneMenu.contains(document.activeElement)) this.toneButton.focus();
      this.toneMenu.hidden = true;
    }
    this.toneButton.setAttribute("aria-expanded", String(open));
  }

  private setTone(tone: number): void {
    this.tone = tone;
    store(TONE_KEY, tone);
    this.toggleTones(false);
    this.renderTone();
    this.input.focus();
    this.draw(false);
  }

  private renderTone(): void {
    if (this.toneButton) this.toneButton.textContent = "✋" + ["", "🏻", "🏼", "🏽", "🏾", "🏿"][this.tone];
  }

  // -- Values ---------------------------------------------------------------

  private choose(cell: Cell): void {
    if (cell.emoji) store(RECENT_KEY, [cell.emoji.char, ...stored<string[]>(RECENT_KEY, []).filter((c) => c !== cell.emoji!.char)].slice(0, RECENT_MAX));
    this.commit(cell.value);
    this.close(true);
  }

  private nameOf(value: string): string {
    return this.options.find((o) => o.value === value)?.label ?? this.data?.byChar.get(value)?.label ?? value;
  }

  private commit(value: string | null): void {
    if (value === this.value) return;
    this.value = value;
    writeNative(this.native, value ? [value] : [], (v) => this.nameOf(v), true);
    this.render();
    this.say(value ? this.nameOf(value) : this.words.t("clear"));
    if (this.config.onChange && this.transport) this.transport.push(this.config.onChange, { id: this.id, value });
    this.el.dispatchEvent(new CustomEvent("erabi:change", { bubbles: true, detail: { id: this.id, value: value ? [value] : [] } }));
  }

  update(): void {
    this.config = readConfig(this.el);
    this.options = [...(this.config.options ?? []), ...(this.config.selected ?? [])].map(option);
    const raw = this.el.dataset.value ?? "[]";
    if (raw !== this.serverValue) {
      this.serverValue = raw;
      const value = readValue(this.el)[0] ?? null;
      if (value !== this.value) {
        this.value = value;
        writeNative(this.native, value ? [value] : [], (v) => this.nameOf(v), false);
      }
    }
    this.render();
  }

  set(value: string[]): void {
    this.value = value[0] ?? null;
    writeNative(this.native, this.value ? [this.value] : [], (v) => this.nameOf(v), false);
    this.render();
  }

  get(): string[] {
    return this.value ? [this.value] : [];
  }

  focus(): void {
    this.field.focus();
  }

  contains(node: Node | null): boolean {
    return !!node && this.el.contains(node);
  }

  // -- Drawing --------------------------------------------------------------

  private render(): void {
    if (this.value) {
      const o = this.options.find((x) => x.value === this.value);
      const glyph = o?.icon ? this.iconNode(o) : el("span", { class: "erabi-emoji-glyph", "aria-hidden": "true" }, this.value);
      this.shown.replaceChildren(glyph, el("span", { class: "erabi-label" }, o?.icon ? this.nameOf(this.value) : heading(this.nameOf(this.value), this.words.locale)));
    } else {
      this.shown.replaceChildren(el("span", { class: "erabi-placeholder" }, this.config.placeholder ?? this.words.t("choose")));
    }
    const clear = this.field.querySelector<HTMLElement>(".erabi-clear");
    if (clear) clear.hidden = !this.value || this.inactive;
    this.el.classList.toggle("erabi-empty", !this.value);
  }

  private renderPreview(): void {
    const cell = this.cells[this.active];
    if (!cell) {
      this.preview.replaceChildren(el("span", { class: "erabi-emoji-preview-hint" }, this.words.t(this.tab === "emoji" ? "pickEmoji" : "pickIcon")));
      return;
    }
    const glyph = cell.icon ? this.iconNode(cell.icon) : el("span", { class: "erabi-emoji-preview-glyph" }, cell.value);
    const code = cell.emoji?.code;
    const text = el("span", { class: "erabi-emoji-preview-text" }, el("span", { class: "erabi-emoji-preview-name" }, heading(cell.label, this.words.locale)));
    if (code) text.append(el("span", { class: "erabi-emoji-preview-code" }, `:${code}:`));
    this.preview.replaceChildren(glyph, text);
  }

  private say(text: string): void {
    this.live.textContent = "";
    requestAnimationFrame(() => (this.live.textContent = text));
  }

  destroy(): void {
    for (const cleanup of this.cleanups) cleanup();
    this.cleanups = [];
    this.popup.destroy();
  }
}
