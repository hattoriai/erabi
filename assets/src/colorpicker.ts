// The color picker: swatches of a palette (Erabi's nine, or the app's
// colors), and, with `custom`, any color: a lightness and chroma area for
// a hue and a hue slider (OKLCH, the way people see colors; each row of
// the area runs out to the most chroma a screen shows), a hex box, the browser's eyedropper, and
// recent colors. It posts a swatch's value, or a custom color as #rrggbb,
// in its native control, as the other pickers do.

import { clampChroma, contrast, hexToRgb, maxChroma, normalizeHex, oklchToRgb, rgbToHex, rgbToOklch, type Oklch } from "./color";
import { internal } from "erabi";
import type { Config, Option, Words } from "./config";
import type { AnyPicker } from "./kinds";
import type { Transport } from "./picker";
import type { Popup } from "./popup";

// The main bundle's, so that a page has one copy (see color-entry.ts).
const { option, readConfig, readValue, el, icon, writeNative, checkValue } = internal;

const PALETTE = new Set(["gray", "brown", "orange", "yellow", "green", "blue", "purple", "pink", "red"]);
const RECENT_KEY = "erabi-colors-recent";
const AREA = { width: 224, height: 136 };

/**
 * A custom color as its area holds it: lightness, hue, and the share of
 * the most chroma a screen shows at that lightness and hue, so that the
 * whole area is colors a screen can show.
 */
interface Custom {
  l: number;
  s: number;
  h: number;
}

function toOklch({ l, s, h }: Custom): Oklch {
  return { l, c: s * maxChroma(l, h), h };
}

function fromHex(hex: string): Custom {
  const { l, c, h } = rgbToOklch(hexToRgb(hex));
  const most = maxChroma(l, h);
  return { l, s: most > 0 ? Math.min(1, c / most) : 0, h };
}

interface EyeDropperResult {
  sRGBHex: string;
}

export class ColorPicker implements AnyPicker {
  readonly id: string;
  private el: HTMLElement;
  private transport: Transport | null;
  private config: Config;
  private words: Words;
  private native: HTMLSelectElement | HTMLInputElement | null;
  private options: Option[] = [];
  private value: string | null = null;
  private serverValue: string;
  private field!: HTMLElement;
  private shown!: HTMLElement;
  private popup!: Popup;
  private swatches!: HTMLElement;
  private live!: HTMLElement;
  private custom: Custom = { l: 0.6, s: 0.6, h: 250 };
  private area: HTMLCanvasElement | null = null;
  private areaThumb: HTMLElement | null = null;
  private hue: HTMLElement | null = null;
  private hueThumb: HTMLElement | null = null;
  private hex: HTMLInputElement | null = null;
  private preview: HTMLElement | null = null;
  private ratio: HTMLElement | null = null;
  private recent: HTMLElement | null = null;
  private areaHue = -1;
  private commitTimer: ReturnType<typeof setTimeout> | null = null;
  private cleanups: (() => void)[] = [];

  constructor(el: HTMLElement, transport: Transport | null) {
    this.el = el;
    this.transport = transport;
    this.config = readConfig(el);
    this.id = this.config.id ?? el.id;
    this.words = new internal.Words(this.config.messages ?? {}, this.config.locale ?? "en");
    this.native = el.querySelector<HTMLSelectElement | HTMLInputElement>('[data-part="value"]');
    this.options = (this.config.options ?? []).map(option);
    this.value = readValue(el)[0] ?? null;
    this.serverValue = el.dataset.value ?? "[]";
    this.build();
    this.render();
    if (this.native) {
      this.native.setAttribute("aria-hidden", "true");
      this.native.tabIndex = -1;
    }
    el.classList.add("erabi-ready");
  }

  private get canCustom(): boolean {
    return !!this.config.rules?.create;
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
      "data-kind": "color",
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

    const body = el("div", { id: `${this.id}-dialog`, class: "erabi-popup-body erabi-color-popup", role: "dialog", "aria-label": config.label ?? this.words.t("color") });
    this.swatches = el("div", { class: "erabi-swatches", role: "listbox", "aria-label": this.words.t("swatches") });
    body.append(this.swatches);
    if (this.canCustom) body.append(this.buildCustom());
    this.popup = new internal.Popup(this.field, body, () => this.close(false), { width: 272, maxHeight: 520 });

    this.live = el("div", { class: "erabi-live", "aria-live": "polite", "aria-atomic": "true" });
    this.el.append(this.field, body, this.live);
    this.listen();
  }

  private buildCustom(): HTMLElement {
    this.area = el("canvas", { class: "erabi-area-canvas", width: String(AREA.width), height: String(AREA.height), "aria-hidden": "true" });
    this.areaThumb = el("span", { class: "erabi-thumb", "aria-hidden": "true" });
    const area = el(
      "div",
      { class: "erabi-area", role: "slider", tabindex: "0", "aria-label": this.words.t("lightnessChroma"), "aria-valuemin": "0", "aria-valuemax": "100" },
      this.area,
      this.areaThumb,
    );
    this.hueThumb = el("span", { class: "erabi-thumb", "aria-hidden": "true" });
    this.hue = el("div", { class: "erabi-hue", role: "slider", tabindex: "0", "aria-label": this.words.t("hue"), "aria-valuemin": "0", "aria-valuemax": "360" }, this.hueThumb);
    this.hex = el("input", { type: "text", class: "erabi-hex", "aria-label": this.words.t("hex"), spellcheck: "false", autocomplete: "off", maxlength: "7" });
    this.preview = el("span", { class: "erabi-preview", "aria-hidden": "true" });
    const row = el("div", { class: "erabi-hex-row" }, this.preview, this.hex);
    if ("EyeDropper" in window) {
      const dropper = el("button", { type: "button", class: "erabi-dropper", "aria-label": this.words.t("eyedropper") }, eyedropperIcon());
      dropper.addEventListener("click", () => void this.eyedrop());
      row.append(dropper);
    }
    this.ratio = this.config.contrast ? el("p", { class: "erabi-ratio" }) : null;
    this.recent = el("div", { class: "erabi-recent", role: "group", "aria-label": this.words.t("recent") });
    const section = el("div", { class: "erabi-custom" }, el("div", { class: "erabi-heading" }, this.words.t("custom")), area, this.hue, row, this.recent);
    if (this.ratio) section.append(this.ratio);

    this.sliding(area, (x, y) => this.setCustom({ ...this.custom, s: x, l: 1 - y }, true));
    this.sliding(this.hue, (x) => this.setCustom({ ...this.custom, h: x * 360 }, true));
    area.addEventListener("keydown", (event) => this.areaKey(event));
    this.hue.addEventListener("keydown", (event) => this.hueKey(event));
    this.hex.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        this.takeHex(true);
      }
    });
    this.hex.addEventListener("change", () => this.takeHex(false));
    return section;
  }

  /** A press and drag on an element, as fractions of its box (0 to 1). */
  private sliding(target: HTMLElement, move: (x: number, y: number) => void): void {
    const at = (event: PointerEvent) => {
      const box = target.getBoundingClientRect();
      const clamp = (v: number) => Math.min(1, Math.max(0, v));
      move(clamp((event.clientX - box.left) / box.width), clamp((event.clientY - box.top) / box.height));
    };
    target.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      target.focus();
      target.setPointerCapture(event.pointerId);
      at(event);
      const onMove = (e: PointerEvent) => at(e);
      const onUp = () => {
        target.removeEventListener("pointermove", onMove);
        target.removeEventListener("pointerup", onUp);
        this.commitCustom(0);
      };
      target.addEventListener("pointermove", onMove);
      target.addEventListener("pointerup", onUp);
    });
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
      }
    });
    on(this.swatches, "keydown", (event) => this.swatchKey(event));
    on(this.swatches, "click", (event) => {
      const swatch = (event.target as Element).closest<HTMLElement>("[data-value]");
      if (swatch) this.choose(swatch.dataset.value!);
    });
    on(this.el, "keydown", (event) => {
      if (event.key === "Escape" && this.popup.open) {
        event.preventDefault();
        event.stopPropagation();
        this.close(true);
      }
    });
    on(this.el, "focusout", (event) => {
      const next = event.relatedTarget as Node | null;
      if (next && this.el.contains(next)) return;
      queueMicrotask(() => {
        if (!this.el.contains(document.activeElement)) this.close(false);
      });
    });
  }

  // -- Open and close -----------------------------------------------------

  open(): void {
    if (this.inactive || this.popup.open) return;
    this.renderSwatches();
    if (this.canCustom) {
      const hex = this.value && normalizeHex(this.value);
      if (hex) this.custom = fromHex(hex);
      this.renderCustom();
      this.renderRecent();
    }
    this.popup.show();
    this.field.setAttribute("aria-expanded", "true");
    this.el.classList.add("erabi-open");
    const chosen = this.swatches.querySelector<HTMLElement>('[aria-selected="true"]') ?? this.swatches.querySelector<HTMLElement>("[data-value]");
    if (chosen) chosen.focus();
    else (this.area?.parentElement as HTMLElement | undefined)?.focus();
    this.popup.place();
  }

  close(restore: boolean): void {
    if (!this.popup.open) return;
    if (this.commitTimer) this.commitCustom(0);
    this.popup.hide();
    this.field.setAttribute("aria-expanded", "false");
    this.el.classList.remove("erabi-open");
    if (restore) this.field.focus();
    this.el.dispatchEvent(new CustomEvent("erabi:closed", { detail: { id: this.id } }));
  }

  /** Starts with what a person typed on a grid's cell: in the hex box, with `custom`. */
  type(text: string): void {
    if (!this.hex) return;
    this.open();
    this.hex.value = text.startsWith("#") ? text : `#${text}`;
    this.hex.focus();
    this.hex.setSelectionRange(this.hex.value.length, this.hex.value.length);
  }

  // -- Values ---------------------------------------------------------------

  private optionOf(value: string): Option | undefined {
    return this.options.find((o) => o.value === value);
  }

  private nameOf(value: string): string {
    return this.optionOf(value)?.label ?? value;
  }

  private choose(value: string): void {
    this.commit(value);
    this.close(true);
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

  /** Takes the server's new render: its value, unless it is the picker's own. */
  update(): void {
    this.config = readConfig(this.el);
    this.options = (this.config.options ?? []).map(option);
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

  // -- Swatches -------------------------------------------------------------

  private renderSwatches(): void {
    const nodes = this.options.map((o) => {
      const selected = o.value === this.value;
      const swatch = el("div", {
        class: "erabi-swatch",
        role: "option",
        tabindex: selected ? "0" : "-1",
        "aria-selected": selected ? "true" : "false",
        "aria-label": o.label,
        title: o.label,
        "data-value": o.value,
      });
      swatch.append(this.sample(o.color ?? o.value));
      return swatch;
    });
    this.swatches.replaceChildren(...nodes);
    // A short palette in one row; a longer one in rows of ten.
    this.swatches.style.setProperty("--erabi-columns", String(Math.min(10, Math.max(1, nodes.length))));
    if (!this.swatches.querySelector('[tabindex="0"]')) this.swatches.querySelector<HTMLElement>("[data-value]")?.setAttribute("tabindex", "0");
  }

  /** How a color shows: a palette color as the chip it makes ("A" on its tint), any other as itself. */
  private sample(color: string, small = false): HTMLElement {
    if (PALETTE.has(color)) {
      return el("span", { class: `erabi-sample erabi-chip${small ? " erabi-sample-small" : ""}`, "data-color": color, "aria-hidden": "true" }, "A");
    }
    const sample = el("span", { class: `erabi-sample erabi-sample-solid${small ? " erabi-sample-small" : ""}`, "aria-hidden": "true" });
    sample.style.setProperty("--erabi-sample", normalizeHex(color) ?? color);
    return sample;
  }

  private swatchKey(event: KeyboardEvent): void {
    const all = Array.from(this.swatches.querySelectorAll<HTMLElement>("[data-value]"));
    const index = all.indexOf(document.activeElement as HTMLElement);
    if (index < 0) return;
    const columns = Math.max(1, Math.round(this.swatches.clientWidth / (all[0]!.offsetWidth || 1)));
    const moves: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: columns, ArrowUp: -columns, Home: -index, End: all.length - 1 - index };
    if (event.key in moves) {
      event.preventDefault();
      const next = all[Math.min(all.length - 1, Math.max(0, index + moves[event.key]!))]!;
      for (const s of all) s.tabIndex = -1;
      next.tabIndex = 0;
      next.focus();
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      this.choose(all[index]!.dataset.value!);
    }
  }

  // -- Custom ---------------------------------------------------------------

  private setCustom(color: Custom, live: boolean): void {
    const clamp = (v: number) => Math.min(1, Math.max(0, v));
    this.custom = { l: clamp(color.l), s: clamp(color.s), h: ((color.h % 360) + 360) % 360 };
    this.renderCustom();
    if (live) this.commitCustom(250);
  }

  /** The custom color, as #rrggbb. */
  private customHex(): string {
    return rgbToHex(oklchToRgb(clampChroma(toOklch(this.custom))));
  }

  private commitCustom(delay: number): void {
    if (this.commitTimer) clearTimeout(this.commitTimer);
    const run = () => {
      this.commitTimer = null;
      const hex = this.customHex();
      const refusal = checkValue(this.config.rules, hex);
      if (refusal) return;
      this.commit(hex);
      this.remember(hex);
    };
    if (delay === 0) run();
    else this.commitTimer = setTimeout(run, delay);
  }

  private takeHex(close: boolean): void {
    const hex = this.hex && normalizeHex(this.hex.value);
    if (!hex) {
      this.say(this.words.t("format"));
      this.hex?.setAttribute("aria-invalid", "true");
      return;
    }
    this.hex!.removeAttribute("aria-invalid");
    this.custom = fromHex(hex);
    this.renderCustom();
    this.commit(hex);
    this.remember(hex);
    if (close) this.close(true);
  }

  private async eyedrop(): Promise<void> {
    try {
      const Dropper = (window as unknown as { EyeDropper: new () => { open(): Promise<EyeDropperResult> } }).EyeDropper;
      const result = await new Dropper().open();
      const hex = normalizeHex(result.sRGBHex);
      if (!hex) return;
      this.custom = fromHex(hex);
      this.renderCustom();
      this.commit(hex);
      this.remember(hex);
    } catch {
      // The person let the eyedropper go (Escape): nothing changes.
    }
  }

  private areaKey(event: KeyboardEvent): void {
    const step = event.shiftKey ? 0.05 : 0.01;
    const moves: Record<string, [number, number]> = { ArrowUp: [step, 0], ArrowDown: [-step, 0], ArrowRight: [0, step], ArrowLeft: [0, -step] };
    const move = moves[event.key];
    if (move) {
      event.preventDefault();
      this.setCustom({ ...this.custom, l: this.custom.l + move[0], s: this.custom.s + move[1] }, true);
    } else if (event.key === "Enter") {
      event.preventDefault();
      this.commitCustom(0);
      this.close(true);
    }
  }

  private hueKey(event: KeyboardEvent): void {
    const step = event.shiftKey ? 10 : 1;
    const moves: Record<string, number> = { ArrowRight: step, ArrowUp: step, ArrowLeft: -step, ArrowDown: -step, PageUp: 30, PageDown: -30 };
    if (event.key in moves) {
      event.preventDefault();
      this.setCustom({ ...this.custom, h: this.custom.h + moves[event.key]! }, true);
    } else if (event.key === "Enter") {
      event.preventDefault();
      this.commitCustom(0);
      this.close(true);
    }
  }

  private renderCustom(): void {
    if (!this.area || !this.areaThumb || !this.hue || !this.hueThumb) return;
    const { l, s, h } = this.custom;
    if (Math.round(h) !== this.areaHue) this.drawArea(Math.round(h));
    const shown = toOklch(this.custom);
    this.areaThumb.style.left = `${s * 100}%`;
    this.areaThumb.style.top = `${(1 - l) * 100}%`;
    this.hueThumb.style.left = `${(h / 360) * 100}%`;
    const hex = this.customHex();
    this.areaThumb.style.background = hex;
    const area = this.area.parentElement!;
    area.setAttribute("aria-valuenow", String(Math.round(l * 100)));
    area.setAttribute("aria-valuetext", this.words.t("lightnessChromaValue", { l: Math.round(l * 100), c: shown.c.toFixed(2) }));
    this.hue.setAttribute("aria-valuenow", String(Math.round(h)));
    if (this.hex && document.activeElement !== this.hex) this.hex.value = hex;
    this.preview?.style.setProperty("--erabi-sample", hex);
    if (this.ratio && this.config.contrast) {
      const ground = normalizeHex(this.config.contrast);
      if (ground) {
        const ratio = contrast(hexToRgb(hex), hexToRgb(ground));
        const grade = ratio >= 7 ? "AAA" : ratio >= 4.5 ? "AA" : ratio >= 3 ? "AA Large" : this.words.t("lowContrast");
        this.ratio.textContent = this.words.t("contrastRatio", { ratio: ratio.toFixed(1), grade, ground });
      }
    }
  }

  /** The lightness and chroma area of a hue: each row from gray to the most chroma a screen shows. */
  private drawArea(h: number): void {
    const canvas = this.area!;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    this.areaHue = h;
    const { width, height } = AREA;
    const image = ctx.createImageData(width, height);
    for (let y = 0; y < height; y++) {
      const l = 1 - y / (height - 1);
      const most = maxChroma(l, h);
      for (let x = 0; x < width; x++) {
        const rgb = oklchToRgb({ l, c: (x / (width - 1)) * most, h });
        const i = (y * width + x) * 4;
        for (let k = 0; k < 3; k++) image.data[i + k] = Math.round(Math.min(1, Math.max(0, rgb[k]!)) * 255);
        image.data[i + 3] = 255;
      }
    }
    ctx.putImageData(image, 0, 0);
  }

  // -- Recent colors --------------------------------------------------------

  private recentColors(): string[] {
    try {
      const list = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]") as unknown;
      return Array.isArray(list) ? list.map(String).filter((c) => normalizeHex(c)).slice(0, 8) : [];
    } catch {
      return [];
    }
  }

  private remember(hex: string): void {
    try {
      const list = [hex, ...this.recentColors().filter((c) => c !== hex)].slice(0, 8);
      localStorage.setItem(RECENT_KEY, JSON.stringify(list));
    } catch {
      // No storage (a private window): no recent colors.
    }
  }

  private renderRecent(): void {
    if (!this.recent) return;
    const buttons = this.recentColors().map((hex) => {
      const button = el("button", { type: "button", class: "erabi-recent-color", "aria-label": hex, title: hex }, this.sample(hex, true));
      button.addEventListener("click", () => {
        this.custom = fromHex(hex);
        this.renderCustom();
        this.choose(hex);
      });
      return button;
    });
    this.recent.replaceChildren(...buttons);
    this.recent.hidden = buttons.length === 0;
  }

  // -- Drawing --------------------------------------------------------------

  private render(): void {
    if (this.value) {
      this.shown.replaceChildren(this.sample(this.optionOf(this.value)?.color ?? this.value, true), el("span", { class: "erabi-label" }, this.nameOf(this.value)));
    } else {
      this.shown.replaceChildren(el("span", { class: "erabi-placeholder" }, this.config.placeholder ?? this.words.t("choose")));
    }
    const clear = this.field.querySelector<HTMLElement>(".erabi-clear");
    if (clear) clear.hidden = !this.value || this.inactive;
    this.el.classList.toggle("erabi-empty", !this.value);
  }

  private say(text: string): void {
    this.live.textContent = "";
    requestAnimationFrame(() => (this.live.textContent = text));
  }

  destroy(): void {
    for (const cleanup of this.cleanups) cleanup();
    this.cleanups = [];
    if (this.commitTimer) clearTimeout(this.commitTimer);
    this.popup.destroy();
  }

}

/** Lucide `pipette`. */
function eyedropperIcon(): SVGSVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("class", "erabi-icon");
  for (const d of ["m2 22 1-1h3l9-9", "M3 21v-3l9-9", "m15 6 3.4-3.4a2.1 2.1 0 1 1 3 3L18 9l.4.4a2.1 2.1 0 1 1-3 3l-3.8-3.8a2.1 2.1 0 1 1 3-3l.4.4Z"]) {
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", d);
    svg.append(path);
  }
  return svg;
}
