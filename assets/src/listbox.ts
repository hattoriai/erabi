// The list of a picker: its rows (options, group headings, "Create …",
// and status lines), the active row that the keys move (the focus stays
// in the field, with aria-activedescendant), and, for long lists, only the
// rows on screen (virtual rows of one height).

import type { Option } from "./config";
import { el, icon } from "./dom";

export type Row =
  | { type: "option"; option: Option; positions: number[]; selected: boolean; blocked?: string }
  | { type: "heading"; label: string }
  | { type: "create"; value: string; label: string; refusal?: string }
  | { type: "status"; text: string; retry?: boolean; busy?: boolean };

/** Whether a row can be the active one: an option, or "Create …". */
export function choosable(row: Row | undefined): boolean {
  if (!row) return false;
  if (row.type === "option") return !row.option.disabled;
  return row.type === "create";
}

/** How a row draws its option: the picker's own look of avatars, colors and icons. */
export type Drawer = (option: Option, positions: number[]) => Node[];

const VIRTUAL = 80;
const OVERSCAN = 8;

export class Listbox {
  readonly el: HTMLElement;
  readonly id: string;
  rows: Row[] = [];
  active = -1;
  private body: HTMLElement;
  private height = 0;
  private draw: Drawer;
  private multiple: boolean;
  onPick: (row: Row) => void = () => {};
  onRetry: () => void = () => {};
  onNearEnd: () => void = () => {};

  constructor(id: string, multiple: boolean, labelledBy: string | null, label: string | null, draw: Drawer) {
    this.id = id;
    this.draw = draw;
    this.multiple = multiple;
    this.body = el("div", { class: "erabi-rows" });
    this.el = el(
      "div",
      { id, class: "erabi-list", role: "listbox", "aria-multiselectable": multiple ? "true" : null, "aria-labelledby": labelledBy, "aria-label": labelledBy ? null : label, tabindex: "-1" },
      this.body,
    );
    // A press on a row picks it, and leaves the focus where it is.
    this.el.addEventListener("pointerdown", (event) => event.preventDefault());
    this.el.addEventListener("click", (event) => {
      const target = (event.target as Element).closest<HTMLElement>("[data-row]");
      if (!target) return;
      const row = this.rows[Number(target.dataset.row)];
      if (row?.type === "status" && row.retry) return this.onRetry();
      if (row && choosable(row)) this.onPick(row);
    });
    this.el.addEventListener("pointermove", (event) => {
      const target = (event.target as Element).closest<HTMLElement>("[data-row]");
      const index = target ? Number(target.dataset.row) : -1;
      if (index >= 0 && index !== this.active && choosable(this.rows[index])) this.setActive(index, false);
    });
    this.el.addEventListener("scroll", () => {
      if (this.virtual()) this.render();
      if (this.el.scrollTop + this.el.clientHeight >= this.el.scrollHeight - this.rowHeight() * 4) this.onNearEnd();
    });
  }

  /** The id of a row's element, for aria-activedescendant. */
  rowId(index: number): string {
    return `${this.id}-${index}`;
  }

  setRows(rows: Row[], active: number): void {
    this.rows = rows;
    this.active = active;
    this.render();
    if (active >= 0) this.scrollTo(active);
  }

  /** The first row that can be active, from an index, going one way. */
  next(from: number, step: 1 | -1): number {
    for (let i = from; i >= 0 && i < this.rows.length; i += step) if (choosable(this.rows[i])) return i;
    return -1;
  }

  move(delta: number): void {
    if (this.rows.length === 0) return;
    const step = delta > 0 ? 1 : -1;
    let index = this.active < 0 ? (step > 0 ? -1 : this.rows.length) : this.active;
    let moved = 0;
    let found = this.active;
    while (moved < Math.abs(delta)) {
      const candidate = this.next(index + step, step);
      if (candidate < 0) break;
      found = candidate;
      index = candidate;
      moved++;
    }
    if (found < 0) found = this.next(step > 0 ? 0 : this.rows.length - 1, step);
    this.setActive(found, true);
  }

  first(): void {
    this.setActive(this.next(0, 1), true);
  }

  last(): void {
    this.setActive(this.next(this.rows.length - 1, -1), true);
  }

  setActive(index: number, scroll: boolean): void {
    const previous = this.body.querySelector(".erabi-active");
    previous?.classList.remove("erabi-active");
    this.active = index;
    if (index >= 0 && scroll) this.scrollTo(index);
    const row = this.body.querySelector(`#${CSS.escape(this.rowId(index))}`);
    row?.classList.add("erabi-active");
    this.el.dispatchEvent(new CustomEvent("erabi:active"));
  }

  private virtual(): boolean {
    return this.rows.length > VIRTUAL;
  }

  /** Measures the row height again (a sheet's rows are taller). */
  remeasure(): void {
    this.height = 0;
  }

  private rowHeight(): number {
    if (this.height === 0) {
      // The row height of the theme, in pixels (it may be in rem).
      const probe = el("div", { style: "position:absolute;visibility:hidden;height:var(--erabi-row-height)" });
      this.el.append(probe);
      const height = probe.getBoundingClientRect().height;
      probe.remove();
      if (height > 0) this.height = height;
      else return 36;
    }
    return this.height;
  }

  private scrollTo(index: number): void {
    if (this.virtual()) {
      const h = this.rowHeight();
      const top = index * h;
      if (top < this.el.scrollTop) this.el.scrollTop = top;
      else if (top + h > this.el.scrollTop + this.el.clientHeight) this.el.scrollTop = top + h - this.el.clientHeight;
      this.render();
      return;
    }
    this.body.querySelector(`#${CSS.escape(this.rowId(index))}`)?.scrollIntoView({ block: "nearest" });
  }

  render(): void {
    const count = this.rows.length;
    let from = 0;
    let to = count;
    if (this.virtual()) {
      const h = this.rowHeight();
      from = Math.max(0, Math.floor(this.el.scrollTop / h) - OVERSCAN);
      to = Math.min(count, Math.ceil((this.el.scrollTop + (this.el.clientHeight || 360)) / h) + OVERSCAN);
      this.body.style.height = `${count * h}px`;
      this.body.classList.add("erabi-virtual");
    } else {
      this.body.style.height = "";
      this.body.classList.remove("erabi-virtual");
    }
    const nodes: Node[] = [];
    const total = this.rows.filter((row) => row.type === "option").length;
    let position = this.rows.slice(0, from).filter((row) => row.type === "option").length;
    for (let i = from; i < to; i++) {
      const row = this.rows[i]!;
      if (row.type === "option") position++;
      const node = this.renderRow(row, i, position, total);
      if (this.virtual()) {
        node.style.position = "absolute";
        node.style.top = `${i * this.rowHeight()}px`;
        node.style.insetInline = "0";
      }
      nodes.push(node);
    }
    // The active row is always there, for aria-activedescendant.
    if (this.active >= 0 && (this.active < from || this.active >= to)) {
      const row = this.rows[this.active]!;
      const node = this.renderRow(row, this.active, this.rows.slice(0, this.active + 1).filter((r) => r.type === "option").length, total);
      node.style.position = "absolute";
      node.style.top = `${this.active * this.rowHeight()}px`;
      node.style.insetInline = "0";
      nodes.push(node);
    }
    this.body.replaceChildren(...nodes);
  }

  private renderRow(row: Row, index: number, position: number, total: number): HTMLElement {
    const active = index === this.active;
    switch (row.type) {
      case "heading":
        return el("div", { class: "erabi-heading", role: "presentation", "data-row": String(index) }, row.label);
      case "status":
        return el(
          "div",
          { class: `erabi-status${row.busy ? " erabi-busy" : ""}${row.retry ? " erabi-retry" : ""}`, role: "presentation", "data-row": String(index) },
          row.text,
        );
      case "create": {
        const node = el(
          "div",
          {
            id: this.rowId(index),
            class: `erabi-option erabi-create${active ? " erabi-active" : ""}${row.refusal ? " erabi-refused" : ""}`,
            role: "option",
            "aria-selected": "false",
            "aria-disabled": row.refusal ? "true" : null,
            "data-row": String(index),
          },
          icon("plus"),
          el("span", { class: "erabi-label" }, row.label),
        );
        if (row.refusal) node.append(el("span", { class: "erabi-hint" }, row.refusal));
        return node;
      }
      case "option": {
        const option = row.option;
        const disabled = !!option.disabled || !!row.blocked;
        const node = el("div", {
          id: this.rowId(index),
          class: `erabi-option${active ? " erabi-active" : ""}${row.selected ? " erabi-selected" : ""}`,
          role: "option",
          "aria-selected": row.selected ? "true" : "false",
          "aria-disabled": disabled ? "true" : null,
          "aria-setsize": String(total),
          "aria-posinset": String(position),
          title: typeof option.disabled === "string" ? option.disabled : (row.blocked ?? null),
          "data-row": String(index),
          "data-value": option.value,
        });
        if (this.multiple) node.append(el("span", { class: "erabi-check", "aria-hidden": "true" }, icon("check")));
        node.append(...this.draw(option, row.positions));
        if (!this.multiple && row.selected) node.append(el("span", { class: "erabi-tick", "aria-hidden": "true" }, icon("check")));
        return node;
      }
    }
  }
}
