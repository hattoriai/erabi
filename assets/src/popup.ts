// The popup of a picker: in the top layer (popover="manual") where the
// browser has it, so that no overflow, transform or zoom of the page clips
// or scales it; under the field, or over it when there is no room below;
// as wide as the field at least. It stays inside the picker's element (a
// grid's editor finds it there), and closes on a press outside.
//
// On a phone (a touch screen that is narrow, or short), it is a sheet
// from the bottom of the screen instead: over a dimmed page that does not
// scroll, with the picker's name and a Done button, above the on-screen
// keyboard, as tall as the screen allows; a press on the dimmed page, a
// swipe down from its top, or Done closes it.

const supportsPopover = typeof HTMLElement !== "undefined" && "showPopover" in HTMLElement.prototype;

/** Where a popup is a sheet: on a phone ("auto"), always, or never. */
export type SheetMode = "auto" | "always" | "never";

/** The phones: touch screens that are narrow, or short (a phone on its side). */
const PHONE = "(pointer: coarse) and (max-width: 640px), (pointer: coarse) and (max-height: 480px)";

/** The click of a press that closed a sheet, which would land on what is under it. */
function swallowClick(): void {
  const stop = (event: Event) => {
    event.preventDefault();
    event.stopPropagation();
    done();
  };
  const done = () => {
    document.removeEventListener("click", stop, true);
    clearTimeout(timer);
  };
  const timer = setTimeout(done, 600);
  document.addEventListener("click", stop, true);
}

/** A popup's own width, instead of its field's, and its tallest; and its sheet. */
export interface PopupSize {
  width?: number;
  maxHeight?: number;
  /** Where it is a sheet (by default, on a phone). */
  sheet?: SheetMode;
  /** The sheet's title: the picker's name. */
  title?: string;
  /** The word of the sheet's button that closes it. */
  done?: string;
}

export class Popup {
  readonly el: HTMLElement;
  open = false;
  /** Whether it is a sheet, while it is open. */
  sheet = false;
  private anchor: HTMLElement;
  private onOutside: () => void;
  private size: PopupSize;
  private head: HTMLElement | null = null;
  private backdrop: HTMLElement | null = null;
  private cleanups: (() => void)[] = [];

  constructor(anchor: HTMLElement, el: HTMLElement, onOutside: () => void, size: PopupSize = {}) {
    this.anchor = anchor;
    this.size = size;
    this.el = el;
    this.onOutside = onOutside;
    el.classList.add("erabi-popup");
    if (supportsPopover) el.setAttribute("popover", "manual");
    el.hidden = true;
  }

  /** Whether the popup would be a sheet, were it to open now. */
  wantsSheet(): boolean {
    const mode = this.size.sheet ?? "auto";
    if (mode !== "auto") return mode === "always";
    return typeof matchMedia === "function" && matchMedia(PHONE).matches;
  }

  /** The place in a sheet's head for a box to type in (a combobox's, while it is a sheet). */
  get slot(): HTMLElement | null {
    return this.head?.querySelector<HTMLElement>(".erabi-sheet-slot") ?? null;
  }

  show(): void {
    if (this.open) return;
    this.open = true;
    this.sheet = this.wantsSheet();
    this.el.classList.toggle("erabi-sheet", this.sheet);
    if (this.sheet) this.openSheet();
    this.el.hidden = false;
    if (supportsPopover && !this.el.matches(":popover-open")) this.el.showPopover();
    this.place();
    const place = () => this.place();
    const outside = (event: PointerEvent) => {
      const target = event.target as Node | null;
      // A press on a sheet's dimmed page (its ::backdrop, or the page under
      // it) closes the sheet, and does nothing on the page.
      if (this.sheet && (target === this.el ? !this.within(event) : !(target && this.el.contains(target)))) {
        swallowClick();
        return this.onOutside();
      }
      if (target && (this.el.contains(target) || this.anchor.contains(target))) return;
      this.onOutside();
    };
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    window.visualViewport?.addEventListener("resize", place);
    window.visualViewport?.addEventListener("scroll", place);
    document.addEventListener("pointerdown", outside, true);
    this.cleanups.push(
      () => window.removeEventListener("resize", place),
      () => window.removeEventListener("scroll", place, true),
      () => window.visualViewport?.removeEventListener("resize", place),
      () => window.visualViewport?.removeEventListener("scroll", place),
      () => document.removeEventListener("pointerdown", outside, true),
    );
  }

  hide(): void {
    if (!this.open) return;
    this.open = false;
    for (const cleanup of this.cleanups) cleanup();
    this.cleanups = [];
    if (supportsPopover && this.el.matches(":popover-open")) this.el.hidePopover();
    this.el.hidden = true;
    this.el.style.translate = "";
    this.backdrop?.remove();
    this.backdrop = null;
  }

  /** Places the popup: a sheet at the bottom of what is on screen; else by the field. */
  place(): void {
    if (!this.open) return;
    if (this.sheet) return this.placeSheet();
    const rect = this.anchor.getBoundingClientRect();
    const viewport = { width: document.documentElement.clientWidth, height: window.innerHeight };
    const gap = 4;
    const margin = 8;
    const width = Math.min(this.size.width ?? Math.max(rect.width, 224), viewport.width - margin * 2);
    const most = this.size.maxHeight ?? 360;
    const below = viewport.height - rect.bottom - gap - margin;
    const above = rect.top - gap - margin;
    const wanted = Math.min(this.el.scrollHeight, most);
    const down = below >= wanted || below >= above;
    const room = Math.max(120, down ? below : above);
    const style = this.el.style;
    style.position = "fixed";
    style.margin = "0";
    style.right = "auto";
    style.width = `${width}px`;
    style.maxHeight = `${Math.min(room, most)}px`;
    const rtl = getComputedStyle(this.anchor).direction === "rtl";
    let left = rtl ? rect.right - width : rect.left;
    left = Math.min(Math.max(left, margin), viewport.width - width - margin);
    style.left = `${left}px`;
    if (down) {
      style.top = `${rect.bottom + gap}px`;
      style.bottom = "auto";
    } else {
      style.top = "auto";
      style.bottom = `${viewport.height - rect.top + gap}px`;
    }
    this.el.dataset.side = down ? "bottom" : "top";
  }

  destroy(): void {
    this.hide();
    this.head?.remove();
  }

  // -- The sheet ------------------------------------------------------------

  private openSheet(): void {
    if (!this.head) {
      const done = document.createElement("button");
      done.type = "button";
      done.className = "erabi-sheet-done";
      done.textContent = this.size.done ?? "Done";
      done.addEventListener("click", () => this.onOutside());
      const title = document.createElement("div");
      title.className = "erabi-sheet-title";
      title.textContent = this.size.title ?? "";
      const bar = document.createElement("div");
      bar.className = "erabi-sheet-bar";
      bar.append(title, done);
      const handle = document.createElement("div");
      handle.className = "erabi-sheet-handle";
      handle.setAttribute("aria-hidden", "true");
      const slot = document.createElement("div");
      slot.className = "erabi-sheet-slot";
      this.head = document.createElement("div");
      this.head.className = "erabi-sheet-head";
      this.head.append(handle, bar, slot);
      this.swipe(this.head);
    }
    this.el.prepend(this.head);
    // Without the top layer, the dimmed page is an element of its own.
    if (!supportsPopover) {
      this.backdrop = document.createElement("div");
      this.backdrop.className = "erabi-sheet-backdrop";
      this.backdrop.addEventListener("pointerdown", () => {
        swallowClick();
        this.onOutside();
      });
      this.el.before(this.backdrop);
    }
    // The page under the sheet does not scroll.
    const root = document.documentElement;
    const overflow = root.style.overflow;
    root.style.overflow = "hidden";
    this.cleanups.push(() => {
      root.style.overflow = overflow;
      this.head?.remove();
    });
  }

  private placeSheet(): void {
    const style = this.el.style;
    const view = window.visualViewport;
    // Above the on-screen keyboard: the bottom of what is on screen.
    const bottom = view ? Math.max(0, window.innerHeight - view.height - view.offsetTop) : 0;
    const height = view ? view.height : window.innerHeight;
    style.position = "fixed";
    style.margin = "0";
    style.left = "0";
    style.right = "0";
    style.top = "auto";
    style.width = "100%";
    style.bottom = `${bottom}px`;
    style.maxHeight = `${Math.max(200, height - 40)}px`;
    this.el.dataset.side = "sheet";
  }

  private within(event: PointerEvent): boolean {
    const box = this.el.getBoundingClientRect();
    return event.clientX >= box.left && event.clientX <= box.right && event.clientY >= box.top && event.clientY <= box.bottom;
  }

  /** A swipe down from the sheet's top closes it: past a third of it, or fast. */
  private swipe(head: HTMLElement): void {
    head.addEventListener("pointerdown", (event) => {
      if (!this.sheet || (event.target as Element).closest("button, input")) return;
      const start = event.clientY;
      const time = event.timeStamp;
      let dy = 0;
      head.setPointerCapture(event.pointerId);
      this.el.classList.add("erabi-dragging");
      const move = (e: PointerEvent) => {
        dy = Math.max(0, e.clientY - start);
        this.el.style.translate = `0 ${dy}px`;
      };
      const up = (e: PointerEvent) => {
        head.removeEventListener("pointermove", move);
        head.removeEventListener("pointerup", up);
        head.removeEventListener("pointercancel", up);
        this.el.classList.remove("erabi-dragging");
        const fast = dy / Math.max(1, e.timeStamp - time) > 0.5;
        if (dy > this.el.offsetHeight / 3 || (fast && dy > 24)) this.onOutside();
        else this.el.style.translate = "";
      };
      head.addEventListener("pointermove", move);
      head.addEventListener("pointerup", up);
      head.addEventListener("pointercancel", up);
    });
  }
}
