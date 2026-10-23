// The popup of a picker: in the top layer (popover="manual") where the
// browser has it, so that no overflow, transform or zoom of the page clips
// or scales it; under the field, or over it when there is no room below;
// as wide as the field at least. It stays inside the picker's element (a
// grid's editor finds it there), and closes on a press outside.

const supportsPopover = typeof HTMLElement !== "undefined" && "showPopover" in HTMLElement.prototype;

export class Popup {
  readonly el: HTMLElement;
  open = false;
  private anchor: HTMLElement;
  private onOutside: () => void;
  private cleanups: (() => void)[] = [];

  constructor(anchor: HTMLElement, el: HTMLElement, onOutside: () => void) {
    this.anchor = anchor;
    this.el = el;
    this.onOutside = onOutside;
    el.classList.add("erabi-popup");
    if (supportsPopover) el.setAttribute("popover", "manual");
    el.hidden = true;
  }

  show(): void {
    if (this.open) return;
    this.open = true;
    this.el.hidden = false;
    if (supportsPopover && !this.el.matches(":popover-open")) this.el.showPopover();
    this.place();
    const place = () => this.place();
    const outside = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (target && (this.el.contains(target) || this.anchor.contains(target))) return;
      this.onOutside();
    };
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    document.addEventListener("pointerdown", outside, true);
    this.cleanups.push(
      () => window.removeEventListener("resize", place),
      () => window.removeEventListener("scroll", place, true),
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
  }

  /** Places the popup by the field: below it, or above it when there is more room there. */
  place(): void {
    if (!this.open) return;
    const rect = this.anchor.getBoundingClientRect();
    const viewport = { width: document.documentElement.clientWidth, height: window.innerHeight };
    const gap = 4;
    const margin = 8;
    const width = Math.min(Math.max(rect.width, 224), viewport.width - margin * 2);
    const below = viewport.height - rect.bottom - gap - margin;
    const above = rect.top - gap - margin;
    const wanted = Math.min(this.el.scrollHeight, 360);
    const down = below >= wanted || below >= above;
    const room = Math.max(120, down ? below : above);
    const style = this.el.style;
    style.position = "fixed";
    style.margin = "0";
    style.width = `${width}px`;
    style.maxHeight = `${Math.min(room, 360)}px`;
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
  }
}
