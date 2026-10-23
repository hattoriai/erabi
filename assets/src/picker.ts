// A picker: one class for every kind. The kind sets the field (a box
// that opens a list, as a select, or a box to type in, as a combobox and
// tags), whether it holds one value or several, and whether people may
// create values. The value is posted by the picker's native control (a
// <select>, or an <input>), so the form sees what it would without
// JavaScript, with `input` and `change` events for phx-change.

import { option, readConfig, readValue, sheetOf, Words, type Config, type Holder, type Kind, type Option, type Peer } from "./config";
import { el, icon, initials } from "./dom";
import { Listbox, choosable, type Row } from "./listbox";
import { writeNative } from "./native";
import { fold, rank, score } from "./match";
import { Popup } from "./popup";
import { checkValue, type Refusal } from "./rules";
import { Search, type Results } from "./search";

export interface Transport {
  push(event: string, payload: Record<string, unknown>, onReply?: (reply: Record<string, unknown>) => void): void;
  /** Pushes to an element of the page (a LiveComponent's). */
  pushTo?(target: string, event: string, payload: Record<string, unknown>): void;
}

const TYPEAHEAD = 600;
/** How long a value the picker posted counts as its own, when the server renders it back. */
const ECHO = 2000;

export class Picker {
  readonly id: string;
  private el: HTMLElement;
  private transport: Transport | null;
  private config: Config;
  private words: Words;
  private native: HTMLSelectElement | HTMLInputElement | null;
  private field!: HTMLElement;
  private control!: HTMLElement;
  private input: HTMLInputElement | null = null;
  /** Where the box to type in was, while a sheet holds it. */
  private inputHome: Comment | null = null;
  private filterInput: HTMLInputElement | null = null;
  private values!: HTMLElement;
  private clearButton: HTMLButtonElement | null = null;
  private popup!: Popup;
  private list!: Listbox;
  private live!: HTMLElement;
  private search: Search | null = null;
  private results: Results | null = null;
  private options: Option[] = [];
  private known = new Map<string, Option>();
  private value: string[] = [];
  private query = "";
  private serverValue = "";
  private posted: { value: string; at: number }[] = [];
  private typed = "";
  private typedAt = 0;
  private message: string | null = null;
  private cleanups: (() => void)[] = [];
  /** With Issho: the others in the picker, and the peek of the list where one of them is. */
  private peers: Peer[] = [];
  /** Who holds the picker's lock: while someone else does, the list does not open here. */
  private holder: Holder | null = null;
  private peersEl!: HTMLElement;
  private peek: Popup | null = null;
  private peekList: Listbox | null = null;
  private placeTimer: ReturnType<typeof setTimeout> | null = null;
  private lastPlace = "null";

  constructor(el: HTMLElement, transport: Transport | null) {
    this.el = el;
    this.transport = transport;
    this.config = readConfig(el);
    this.id = this.config.id ?? el.id;
    this.words = new Words(this.config.messages ?? {}, this.config.locale ?? "en");
    this.native = el.querySelector<HTMLSelectElement | HTMLInputElement>('[data-part="value"]');
    this.setOptions();
    this.value = readValue(el);
    this.serverValue = JSON.stringify(this.value);
    if (this.config.search) this.search = new Search(this.id, transport ? (event, payload, reply) => transport.push(event, payload, reply) : null, (results) => this.onResults(results));
    this.build();
    this.render();
    if (this.native) {
      // The native control posts the value; the field is what people use.
      this.native.setAttribute("aria-hidden", "true");
      this.native.tabIndex = -1;
      const invalid = (event: Event) => {
        event.preventDefault();
        this.control.focus();
        this.say(this.words.t("required"));
      };
      this.native.addEventListener("invalid", invalid);
      this.cleanups.push(() => this.native?.removeEventListener("invalid", invalid));
    }
    el.classList.add("erabi-ready");
  }

  // -- The kinds ----------------------------------------------------------

  private get kind(): Kind {
    return this.config.kind;
  }

  private get multiple(): boolean {
    return this.config.multiple;
  }

  /** A box to type in (combobox, tags), rather than a box that opens a list. */
  private get typing(): boolean {
    return this.kind === "combobox" || this.kind === "tags";
  }

  /** A box to filter the list in its popup (a select of many options, or of a search). */
  private get filtering(): boolean {
    return !this.typing && (!!this.config.filter || !!this.config.search);
  }

  private get canCreate(): boolean {
    return !!this.config.rules?.create;
  }

  private get inactive(): boolean {
    return !!this.config.disabled || !!this.config.readonly;
  }

  // -- Building -----------------------------------------------------------

  private build(): void {
    const listId = `${this.id}-list`;
    const config = this.config;
    // A <label for> of the native control names the picker, and a click on it opens it.
    const label = !config.labelId && this.native?.labels?.[0] ? this.native.labels[0] : null;
    if (label) {
      label.id ||= `${this.id}-label`;
      config.labelId = label.id;
      label.addEventListener("click", (event) => {
        event.preventDefault();
        this.control.focus();
      });
    }
    const named = { "aria-labelledby": config.labelId ?? null, "aria-label": config.labelId ? null : (config.label ?? null) };
    const described = { "aria-describedby": config.describedBy ?? null, "aria-invalid": config.invalid ? "true" : null };

    this.values = el("span", { class: "erabi-values" });
    this.field = el("div", { class: "erabi-field", "data-kind": this.kind });

    if (this.typing) {
      this.input = el("input", {
        type: "text",
        class: "erabi-input",
        role: "combobox",
        "aria-autocomplete": "list",
        "aria-expanded": "false",
        "aria-controls": listId,
        autocomplete: "off",
        autocapitalize: "off",
        spellcheck: "false",
        placeholder: config.placeholder ?? (this.kind === "tags" ? this.words.t("search") : this.words.t("choose")),
        ...named,
        ...described,
        disabled: config.disabled ? "" : null,
        readonly: config.readonly ? "" : null,
      });
      this.control = this.input;
      this.field.append(this.values, this.input);
    } else {
      this.control = this.field;
      for (const [name, value] of Object.entries({
        role: "combobox",
        tabindex: config.disabled ? "-1" : "0",
        "aria-haspopup": this.filtering ? "dialog" : "listbox",
        "aria-expanded": "false",
        "aria-controls": listId,
        "aria-disabled": config.disabled ? "true" : null,
        "aria-readonly": config.readonly ? "true" : null,
        ...named,
        ...described,
      })) {
        if (value !== null) this.field.setAttribute(name, value);
      }
      this.field.append(this.values);
    }

    if (config.clearable && !this.multiple) {
      this.clearButton = el("button", { type: "button", class: "erabi-clear", tabindex: "-1", "aria-label": this.words.t("clear") }, icon("close"));
      this.clearButton.addEventListener("click", (event) => {
        event.stopPropagation();
        this.commit([]);
        this.control.focus();
      });
      this.field.append(this.clearButton);
    }
    this.peersEl = el("span", { class: "erabi-peers", "aria-hidden": "true" });
    this.field.append(this.peersEl);
    this.field.append(el("span", { class: "erabi-chevron", "aria-hidden": "true" }, icon("chevron")));

    this.list = new Listbox(listId, this.multiple, config.labelId ?? null, config.label ?? null, (option, positions) => this.draw(option, positions, "row"));
    this.list.onPick = (row) => this.pick(row);
    this.list.onRetry = () => this.search?.run(this.query);
    this.list.onNearEnd = () => this.search?.more(this.query);
    this.list.el.addEventListener("erabi:active", () => {
      this.syncActive();
      this.tellPlace();
    });

    const popup = el("div", { class: "erabi-popup-body", role: this.filtering ? "dialog" : null, "aria-label": this.filtering ? (config.label ?? null) : null });
    if (this.filtering) {
      this.filterInput = el("input", {
        type: "text",
        class: "erabi-filter",
        role: "combobox",
        "aria-autocomplete": "list",
        "aria-expanded": "true",
        "aria-controls": listId,
        "aria-label": this.words.t("search"),
        placeholder: this.words.t("search"),
        autocomplete: "off",
        spellcheck: "false",
      });
      popup.append(el("div", { class: "erabi-filter-box" }, icon("search"), this.filterInput));
    }
    popup.append(this.list.el);
    // A sheet closed by Done, its dimmed page or a swipe is left, as a focus that goes.
    this.popup = new Popup(this.field, popup, () => (this.popup.sheet ? this.leave() : this.close(false)), sheetOf(config, this.words));

    this.live = el("div", { class: "erabi-live", "aria-live": "polite", "aria-atomic": "true" });
    this.el.append(this.field, popup, this.live);
    this.listen();
    this.share();
  }

  private listen(): void {
    const on = <K extends keyof HTMLElementEventMap>(target: HTMLElement, type: K, handler: (event: HTMLElementEventMap[K]) => void) => {
      target.addEventListener(type, handler as EventListener);
      this.cleanups.push(() => target.removeEventListener(type, handler as EventListener));
    };

    on(this.field, "click", (event) => {
      if (this.inactive) return;
      const remove = (event.target as Element).closest<HTMLElement>("[data-remove]");
      if (remove) {
        event.stopPropagation();
        this.remove(remove.dataset.remove!);
        return;
      }
      if (this.typing) {
        this.input!.focus();
        if (!this.popup.open) this.open();
      } else if (this.popup.open) this.close(true);
      else this.open();
    });
    on(this.control, "keydown", (event) => this.onKey(event, this.control));
    if (this.filterInput) {
      const filter = this.filterInput;
      on(filter, "keydown", (event) => this.onKey(event, filter));
      on(filter, "input", () => this.setQuery(filter.value));
    }
    if (this.input) {
      const input = this.input;
      on(input, "input", () => {
        this.message = null;
        this.setQuery(input.value);
        if (!this.popup.open) this.open();
      });
    }
    on(this.el, "focusout", (event) => {
      const next = event.relatedTarget as Node | null;
      // A sheet stays as the focus goes (a phone's keyboard put away, a tap
      // in it): Done, the dimmed page, a swipe or a choice closes it.
      if ((next && this.el.contains(next)) || (this.popup.open && this.popup.sheet)) return;
      // The focus went into the popup's own box (top layer, still inside the element).
      queueMicrotask(() => {
        if (this.el.contains(document.activeElement)) return;
        this.leave();
      });
    });
  }

  // -- Options and values -------------------------------------------------

  private setOptions(): void {
    const created = this.options.filter((o) => o.created);
    const person = (o: Option) => this.personal(o);
    this.options = (this.config.options ?? []).map(option).map(person);
    for (const extra of created) if (!this.options.some((o) => o.value === extra.value)) this.options.push(extra);
    for (const o of this.options) this.known.set(o.value, o);
    for (const wire of this.config.selected ?? []) {
      const o = person(option(wire));
      if (!this.known.has(o.value)) this.known.set(o.value, o);
    }
    if (this.kind === "person" && this.config.me) {
      const me = this.options.find((o) => o.value === this.config.me);
      if (me) this.options = [me, ...this.options.filter((o) => o !== me)];
    }
  }

  /** In a picker of people, every option is a person (an avatar); an agent only when it says so. */
  private personal(o: Option): Option {
    return this.kind === "person" ? { ...o, person: o.person ?? "human" } : o;
  }

  /** The option of a value: an option, a search's, or the value as its own label. */
  private optionOf(value: string): Option {
    return this.known.get(value) ?? { value, label: value, created: true };
  }

  /** Takes the server's new render: its options, and its value unless it is an echo of the picker's own. */
  update(): void {
    this.config = readConfig(this.el);
    this.words = new Words(this.config.messages ?? {}, this.config.locale ?? "en");
    this.setOptions();
    const raw = this.el.dataset.value ?? "[]";
    if (raw !== this.serverValue) {
      this.serverValue = raw;
      const value = readValue(this.el);
      const now = Date.now();
      this.posted = this.posted.filter((post) => now - post.at < ECHO);
      const echo = this.posted.some((post) => post.value === JSON.stringify(value));
      if (!echo && JSON.stringify(value) !== JSON.stringify(this.value)) {
        this.value = value;
        this.writeNative(false);
      }
    }
    this.render();
    if (this.popup.open) this.refresh(false);
  }

  /** Sets the value from the server (Erabi.Live.set/3), without posting it back. */
  set(value: string[]): void {
    this.value = value.filter((v) => v !== "");
    this.writeNative(false);
    this.render();
    if (this.popup.open) this.refresh(false);
  }

  /** The picker's value: the values it posts. */
  get(): string[] {
    return [...this.value];
  }

  private commit(value: string[], announce?: string): void {
    const before = JSON.stringify(this.value);
    this.value = value;
    if (JSON.stringify(value) === before) return;
    this.posted.push({ value: JSON.stringify(value), at: Date.now() });
    this.writeNative(true);
    this.render();
    if (announce) this.say(announce);
    if (this.config.onChange && this.transport) {
      this.transport.push(this.config.onChange, { id: this.id, value: this.multiple ? value : (value[0] ?? null) });
    }
    this.el.dispatchEvent(new CustomEvent("erabi:change", { bubbles: true, detail: { id: this.id, value: this.get() } }));
  }

  /** Writes the value into the native control that the form posts, and tells the form. */
  private writeNative(notify: boolean): void {
    writeNative(this.native, this.value, (value) => this.optionOf(value).label, notify);
  }

  private add(o: Option): void {
    if (this.value.includes(o.value)) return;
    const max = this.config.rules?.max;
    if (max !== undefined && this.value.length >= max) {
      this.say(this.words.count("tooMany", max));
      return;
    }
    if (!this.known.has(o.value)) this.known.set(o.value, o);
    if (o.created && !this.options.some((x) => x.value === o.value)) this.options.push(o);
    this.commit([...this.value, o.value], this.words.t("added", { label: o.label }));
  }

  private remove(value: string): void {
    if (!this.value.includes(value)) return;
    this.commit(
      this.value.filter((v) => v !== value),
      this.words.t("removed", { label: this.optionOf(value).label }),
    );
    if (this.popup.open) this.refresh(false);
  }

  // -- Open and close -----------------------------------------------------

  open(): void {
    if (this.inactive || this.popup.open) return;
    if (this.lockedBy()) {
      this.say(this.words.t("choosing", { name: this.lockedBy()!.name ?? "" }));
      this.field.classList.remove("erabi-refused");
      void this.field.offsetWidth;
      this.field.classList.add("erabi-refused");
      return;
    }
    if (this.popup.wantsSheet() !== this.popup.sheet) this.list.remeasure();
    this.popup.show();
    this.control.setAttribute("aria-expanded", "true");
    this.el.classList.add("erabi-open");
    // In a sheet, the box to type in goes with it, above the keyboard.
    if (this.popup.sheet && this.input && this.popup.slot) {
      this.inputHome = document.createComment("erabi-input");
      this.input.replaceWith(this.inputHome);
      this.popup.slot.append(this.input);
      this.input.focus();
    }
    if (this.filterInput) {
      this.filterInput.value = this.query;
      this.filterInput.focus();
    }
    if (this.search && !this.results) this.search.run(this.query);
    this.refresh(true);
    this.popup.place();
    this.hidePeek();
    this.tellPlace();
  }

  /** Closes the list; `restore` gives the focus back to the field. */
  close(restore: boolean): void {
    if (!this.popup.open) return;
    if (this.inputHome && this.input) {
      const focused = document.activeElement === this.input;
      this.inputHome.replaceWith(this.input);
      this.inputHome = null;
      if (focused && restore) this.input.focus();
    }
    this.popup.hide();
    this.control.setAttribute("aria-expanded", "false");
    this.control.removeAttribute("aria-activedescendant");
    this.filterInput?.removeAttribute("aria-activedescendant");
    this.el.classList.remove("erabi-open");
    if (this.filtering) this.setQuery("", false);
    if (restore) this.control.focus();
    this.tellPlace();
    this.showPeek();
  }

  /** The focus left the picker: the list closes, and a typed value is kept or taken back. */
  private leave(): void {
    this.close(false);
    if (this.kind === "combobox" && this.input) {
      const text = this.input.value.trim();
      const current = this.value[0] ? this.optionOf(this.value[0]).label : "";
      if (text !== current) {
        if (text === "") this.commit([]);
        else if (this.canCreate && !checkValue(this.config.rules, text)) this.commit([text]);
      }
      this.query = "";
      this.render();
    }
    if (this.kind === "tags" && this.input) {
      this.input.value = "";
      this.query = "";
    }
  }

  // -- The list -----------------------------------------------------------

  private setQuery(query: string, refresh = true): void {
    this.query = query;
    if (this.search) this.search.run(query.trim());
    if (refresh && this.popup.open) this.refresh(true);
  }

  private onResults(found: Results): void {
    const results = { ...found, options: found.options.map((o) => this.personal(o)) };
    // While the next answer loads, the last one stays on screen.
    if (results.state === "loading" && this.results && this.results.options.length > 0) {
      this.results = { ...this.results, state: "loading" };
    } else {
      this.results = results;
    }
    for (const o of results.options) if (!this.known.has(o.value)) this.known.set(o.value, o);
    if (this.popup.open) this.refresh(results.state !== "loading");
  }

  /** The options the list shows for the query, best first. */
  private candidates(): { option: Option; positions: number[] }[] {
    const query = this.query.trim();
    if (this.search) {
      return (this.results?.options ?? []).map((o) => ({ option: o, positions: query ? (score(o, query)?.positions ?? []) : [] }));
    }
    if (!query) return this.options.map((o) => ({ option: o, positions: [] }));
    return rank(this.options, query).map(({ option: o, result }) => ({ option: o, positions: result.positions }));
  }

  private rows(): Row[] {
    const query = this.query.trim();
    const chosen = new Set(this.value);
    const max = this.config.rules?.max;
    const full = this.multiple && max !== undefined && this.value.length >= max;
    const found = this.candidates();
    const rows: Row[] = [];

    const grouped = !query && found.some((f) => f.option.group);
    let group: string | undefined;
    for (const { option: o, positions } of found) {
      if (grouped && o.group !== group) {
        group = o.group;
        if (group) rows.push({ type: "heading", label: group });
      }
      const selected = chosen.has(o.value);
      rows.push({ type: "option", option: o, positions, selected, blocked: full && !selected ? this.words.count("tooMany", max!) : undefined });
    }

    if (this.canCreate && query) {
      const same = (o: Option) => fold(o.label) === fold(query) || o.value === query;
      if (!found.some((f) => same(f.option)) && !this.value.some((v) => same(this.optionOf(v)))) {
        const refusal = checkValue(this.config.rules, query);
        rows.push({ type: "create", value: query, label: this.words.t("create", { value: query }), refusal: refusal ? this.refusalText(refusal) : undefined });
      }
    }

    const state = this.search ? (this.results?.state ?? "loading") : "done";
    if (this.message) rows.unshift({ type: "status", text: this.message });
    if (state === "error") rows.push({ type: "status", text: `${this.words.t("loadFailed")} · ${this.words.t("retry")}`, retry: true });
    else if (state === "loading" && found.length === 0) rows.push({ type: "status", text: this.words.t("searching"), busy: true });
    else if (rows.length === 0) rows.push({ type: "status", text: query ? this.words.t("noMatches") : this.words.t("noOptions") });
    return rows;
  }

  /** Draws the list again; `reset` moves the active row to the chosen value, or to the best match. */
  private refresh(reset: boolean): void {
    const rows = this.rows();
    const previous = this.list.rows[this.list.active];
    let active = -1;
    if (!reset && previous && (previous.type === "option" || previous.type === "create")) {
      const key = previous.type === "option" ? previous.option.value : `create:${previous.value}`;
      active = rows.findIndex((row) => (row.type === "option" ? row.option.value : row.type === "create" ? `create:${row.value}` : null) === key);
    }
    if (active < 0 && !this.query.trim() && !this.multiple && this.value[0]) {
      active = rows.findIndex((row) => row.type === "option" && row.option.value === this.value[0]);
    }
    if (active < 0) active = rows.findIndex((row) => choosable(row));
    this.list.setRows(rows, active);
    this.list.el.setAttribute("aria-busy", this.results?.state === "loading" ? "true" : "false");
    this.syncActive();
    if (reset && this.query.trim()) {
      const count = rows.filter((row) => row.type === "option").length;
      this.say(count ? this.words.count("results", count) : this.words.t("noMatches"));
    }
    this.popup.place();
  }

  private syncActive(): void {
    const target = this.filterInput ?? this.control;
    const active = this.list.active;
    if (this.popup.open && active >= 0) target.setAttribute("aria-activedescendant", this.list.rowId(active));
    else target.removeAttribute("aria-activedescendant");
  }

  private pick(row: Row): void {
    if (row.type === "create") {
      if (row.refusal) {
        this.say(row.refusal);
        return;
      }
      const created: Option = { value: row.value, label: row.value, created: true };
      this.choose(created);
      return;
    }
    if (row.type !== "option" || row.option.disabled) return;
    if (row.blocked) {
      this.say(row.blocked);
      return;
    }
    this.choose(row.option);
  }

  private choose(o: Option): void {
    this.message = null;
    if (!this.multiple) {
      if (!this.known.has(o.value)) this.known.set(o.value, o);
      if (o.created && !this.options.some((x) => x.value === o.value)) this.options.push(o);
      this.commit([o.value], this.words.t("added", { label: o.label }));
      this.query = "";
      this.close(true);
      this.render();
      return;
    }
    if (this.value.includes(o.value)) this.remove(o.value);
    else this.add(o);
    if (this.kind === "tags" && this.input) {
      this.input.value = "";
      this.setQuery("", false);
    }
    this.refresh(false);
  }

  // -- Keys ---------------------------------------------------------------

  private onKey(event: KeyboardEvent, target: HTMLElement): void {
    if (event.isComposing || event.keyCode === 229 || this.inactive) return;
    const open = this.popup.open;
    const inBox = target instanceof HTMLInputElement;
    const empty = !inBox || (target as HTMLInputElement).value === "";

    switch (event.key) {
      case "ArrowDown":
      case "ArrowUp": {
        event.preventDefault();
        if (!open) {
          this.open();
          if (event.key === "ArrowUp" && !event.altKey) this.list.last();
        } else if (event.altKey && event.key === "ArrowUp") this.close(true);
        else this.list.move(event.key === "ArrowDown" ? 1 : -1);
        return;
      }
      case "PageDown":
      case "PageUp":
        if (!open) return;
        event.preventDefault();
        this.list.move(event.key === "PageDown" ? 10 : -10);
        return;
      case "Home":
      case "End":
        if (!open || !empty) return;
        event.preventDefault();
        if (event.key === "Home") this.list.first();
        else this.list.last();
        return;
      case "Enter": {
        if (open) {
          const row = this.list.rows[this.list.active];
          if (row && choosable(row)) {
            event.preventDefault();
            this.pick(row);
          } else if (this.typing) event.preventDefault();
          return;
        }
        if (!this.typing) {
          event.preventDefault();
          this.open();
        }
        return;
      }
      case " ":
        if (inBox) return;
        event.preventDefault();
        if (this.popup.open && Date.now() - this.typedAt < TYPEAHEAD) {
          this.typeahead(" ");
          return;
        }
        if (!open) this.open();
        else {
          const row = this.list.rows[this.list.active];
          if (row && choosable(row)) this.pick(row);
        }
        return;
      case "Escape":
        if (open) {
          event.preventDefault();
          event.stopPropagation();
          this.close(true);
          if (this.kind === "combobox") this.render();
        } else if (this.typing && this.query) {
          event.preventDefault();
          event.stopPropagation();
          this.input!.value = "";
          this.setQuery("");
          this.render();
        }
        return;
      case "Tab":
        if (open) this.close(false);
        return;
      case "Backspace":
      case "Delete":
        if (!empty) return;
        if (this.multiple && this.value.length > 0 && target !== this.filterInput) {
          event.preventDefault();
          this.remove(this.value[this.value.length - 1]!);
        } else if (!this.multiple && this.config.clearable && !this.typing && this.value.length > 0) {
          event.preventDefault();
          this.commit([]);
        }
        return;
      case ",":
        if (this.kind === "tags" && this.canCreate && this.query.trim()) {
          event.preventDefault();
          const create = this.list.rows.find((row) => row.type === "create");
          if (create) this.pick(create);
        }
        return;
    }

    // A letter on a box that opens a list: a search in its popup, or the next option that starts so.
    if (!inBox && event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      if (this.filtering) {
        this.open();
        this.filterInput!.value = event.key;
        this.setQuery(event.key);
        return;
      }
      this.typeahead(event.key);
    }
  }

  private typeahead(key: string): void {
    const now = Date.now();
    this.typed = now - this.typedAt > TYPEAHEAD ? key : this.typed + key;
    this.typedAt = now;
    if (!this.popup.open) this.open();
    const wanted = fold(this.typed);
    const rows = this.list.rows;
    const start = this.typed.length === 1 ? this.list.active + 1 : Math.max(this.list.active, 0);
    for (let k = 0; k < rows.length; k++) {
      const i = (start + k) % rows.length;
      const row = rows[i];
      if (row?.type === "option" && choosable(row) && fold(row.option.label).startsWith(wanted)) {
        this.list.setActive(i, true);
        return;
      }
    }
  }

  // -- Drawing ------------------------------------------------------------

  private render(): void {
    const chosen = this.value.map((v) => this.optionOf(v));
    const nodes: Node[] = [];
    if (this.multiple) {
      for (const o of chosen) nodes.push(this.chip(o));
      if (chosen.length === 0 && !this.typing) nodes.push(el("span", { class: "erabi-placeholder" }, this.config.placeholder ?? this.words.t("choose")));
    } else if (this.kind === "combobox") {
      if (this.input && document.activeElement !== this.input) this.input.value = chosen[0]?.label ?? "";
      else if (this.input && !this.query) this.input.value = chosen[0]?.label ?? "";
      if (chosen[0] && (chosen[0].avatar || chosen[0].person || chosen[0].color || chosen[0].icon)) nodes.push(...this.visual(chosen[0]));
    } else if (chosen[0]) {
      nodes.push(...this.draw(chosen[0], [], "value"));
    } else {
      nodes.push(el("span", { class: "erabi-placeholder" }, this.config.placeholder ?? this.words.t("choose")));
    }
    this.values.replaceChildren(...nodes);
    this.el.classList.toggle("erabi-empty", this.value.length === 0);
    if (this.clearButton) this.clearButton.hidden = this.value.length === 0 || this.inactive;
  }

  private chip(o: Option): HTMLElement {
    const chip = el("span", { class: "erabi-chip", "data-value": o.value });
    // A person's color is their avatar's; their chip stays neutral.
    if (!o.person && !o.avatar) this.paint(chip, o.color);
    chip.append(...this.visual(o), el("span", { class: "erabi-chip-label" }, o.label));
    if (!this.inactive) {
      chip.append(el("span", { class: "erabi-remove", "data-remove": o.value, "aria-hidden": "true", title: this.words.t("remove", { label: o.label }) }, icon("close")));
    }
    return chip;
  }

  /** An option's look: in the list (a row), or in the field (its value). */
  private draw(o: Option, positions: number[], where: "row" | "value"): Node[] {
    const label = el("span", { class: "erabi-label" }, ...highlight(o.label, positions));
    let main: HTMLElement = label;
    if (o.color && !o.avatar && !o.person) {
      main = el("span", { class: "erabi-chip" }, label);
      this.paint(main, o.color);
    }
    const nodes: Node[] = [...(o.color && !o.avatar && !o.person ? [] : this.visual(o)), main];
    if (o.person === "agent") nodes.push(el("span", { class: "erabi-badge" }, this.words.t("agent")));
    if (where === "row") for (const peer of this.peers.filter((p) => p.at.open && p.at.option === o.value)) nodes.push(this.peerMark(peer));
    if (this.config.me && o.value === this.config.me && where === "row") nodes.push(el("span", { class: "erabi-me" }, this.words.t("me")));
    if (o.hint && where === "row") nodes.push(el("span", { class: "erabi-hint" }, o.hint));
    if (typeof o.disabled === "string" && where === "row") nodes.push(el("span", { class: "erabi-hint" }, o.disabled));
    return nodes;
  }

  /** The picture of an option: a person's avatar, or the app's icon. */
  private visual(o: Option): Node[] {
    if (o.avatar || o.person) {
      const avatar = el("span", { class: "erabi-avatar", "data-kind": o.person ?? "human", "aria-hidden": "true" });
      if (o.color) avatar.style.setProperty("--erabi-avatar-color", paletteColor(o.color));
      if (o.avatar) avatar.append(el("img", { src: o.avatar, alt: "", loading: "lazy" }));
      else avatar.append(el("span", { class: "erabi-initials" }, initials(o.label)));
      return [avatar];
    }
    if (o.icon && this.config.icons) {
      const template = this.el.querySelector<HTMLTemplateElement>(`template[data-erabi-icon="${CSS.escape(o.icon)}"]`);
      if (template) return [el("span", { class: "erabi-option-icon", "aria-hidden": "true" }, template.content.cloneNode(true))];
    }
    return [];
  }

  private paint(node: HTMLElement, color: string | undefined): void {
    if (!color) return;
    if (PALETTE.has(color)) node.dataset.color = color;
    else node.style.setProperty("--erabi-chip-color", color);
  }

  private refusalText(refusal: Refusal): string {
    switch (refusal.kind) {
      case "too_short":
        return this.words.count("tooShort", refusal.min_length!);
      case "too_long":
        return this.words.count("tooLong", refusal.max_length!);
      case "too_many":
        return this.words.count("tooMany", refusal.max!);
      case "too_few":
        return this.words.count("tooFew", refusal.min!);
      case "not_allowed":
        return this.words.t("notAllowed");
      case "format":
        return this.words.t("format");
      case "duplicate":
        return this.words.t("duplicate");
      case "required":
        return this.words.t("required");
    }
  }

  private say(text: string): void {
    this.live.textContent = "";
    // A new node, so that the same words twice are said twice.
    requestAnimationFrame(() => (this.live.textContent = text));
  }

  // -- Others choosing (Erabi.Issho) --------------------------------------

  /**
   * Issho's pointers, through the symbols it reads (no import of it): a
   * place of the picker (`{open, option}`, or `{}` for the field) is
   * where its option or its field is on this screen, and a person's
   * pointer over an option of their list is that option.
   */
  private share(): void {
    const element = this.el as unknown as Record<symbol, unknown>;
    const locator = (at: unknown) => this.locate(at);
    const pointer = (x: number, y: number) => this.placeAt(x, y);
    element[Symbol.for("issho.locator")] = locator;
    element[Symbol.for("issho.point")] = pointer;
    this.cleanups.push(() => {
      if (element[Symbol.for("issho.locator")] === locator) delete element[Symbol.for("issho.locator")];
      if (element[Symbol.for("issho.point")] === pointer) delete element[Symbol.for("issho.point")];
    });
  }

  private locate(at: unknown): DOMRect | null {
    const place = (typeof at === "object" && at !== null ? at : {}) as Peer["at"];
    if (place.option !== undefined) {
      const lists = [this.popup.open ? this.list : null, this.peek?.open ? this.peekList : null];
      for (const list of lists) {
        const row = list?.el.querySelector<HTMLElement>(`[data-value="${CSS.escape(place.option)}"]`);
        if (row) return row.getBoundingClientRect();
      }
    }
    return this.field.getBoundingClientRect();
  }

  private placeAt(x: number, y: number): Peer["at"] | null {
    const target = document.elementFromPoint(x, y);
    if (!target || !this.el.contains(target)) return null;
    const row = target.closest<HTMLElement>("[data-value]");
    if (row && this.list.el.contains(row)) {
      const box = row.getBoundingClientRect();
      const fraction = (v: number, from: number, size: number) => Math.round(Math.min(1, Math.max(0, (v - from) / size)) * 100) / 100;
      return { open: true, option: row.dataset.value!, x: fraction(x, box.left, box.width), y: fraction(y, box.top, box.height) };
    }
    return this.field.contains(target) ? {} : null;
  }

  /** Tells the picker's room where its person is: the option of their open list, or nowhere. */
  private tellPlace(): void {
    const target = this.config.issho?.target;
    if (!target || !this.transport?.pushTo) return;
    const row = this.list.rows[this.list.active];
    const at = this.popup.open ? { open: true, ...(row?.type === "option" ? { option: row.option.value } : {}) } : null;
    const json = JSON.stringify(at);
    if (json === this.lastPlace) return;
    this.lastPlace = json;
    if (this.placeTimer) clearTimeout(this.placeTimer);
    this.placeTimer = setTimeout(() => this.transport?.pushTo?.(target, "erabi:place", { at }), 80);
  }

  /** Someone else holds the picker's lock. */
  private lockedBy(): Holder | null {
    return this.holder && !this.holder.mine ? this.holder : null;
  }

  /** The others in the picker, and who holds its lock (Erabi.Issho's "erabi:people"). */
  setPeers(peers: Peer[], holder: Holder | null = null): void {
    this.holder = holder;
    const locked = this.lockedBy();
    this.field.classList.toggle("erabi-locked", !!locked);
    if (this.input) this.input.readOnly = !!locked || !!this.config.readonly;
    // Two opened it at once: the one who opened it first keeps it.
    if (locked && this.popup.open) {
      this.close(false);
      this.say(this.words.t("choosing", { name: locked.name ?? "" }));
    }
    const before = new Set(this.peers.filter((p) => p.at.open).map((p) => p.key));
    this.peers = peers;
    const choosing = peers.filter((p) => p.at.open);
    this.peersEl.replaceChildren(...peers.slice(0, 3).map((p) => this.peerMark(p)));
    this.field.classList.toggle("erabi-peer-open", choosing.length > 0);
    if (choosing[0]) this.field.style.setProperty("--erabi-peer", choosing[0].color);
    else this.field.style.removeProperty("--erabi-peer");
    this.field.title = choosing.map((p) => this.words.t("choosing", { name: p.name })).join(", ");
    for (const p of choosing) if (!before.has(p.key)) this.say(this.words.t("choosing", { name: p.name }));
    if (this.popup.open) this.refresh(false);
    else this.showPeek();
  }

  private peerMark(peer: Peer): HTMLElement {
    const mark = el("span", { class: "erabi-avatar erabi-peer", "data-kind": peer.kind, title: peer.name });
    mark.style.setProperty("--erabi-avatar-color", peer.color);
    if (peer.avatar) mark.append(el("img", { src: peer.avatar, alt: "" }));
    else mark.append(el("span", { class: "erabi-initials" }, initials(peer.name)));
    return mark;
  }

  /**
   * The list as someone else has it open, on a screen where it is closed:
   * read-only, their option marked in their color, so that the people see
   * an agent (or a person) go through the options.
   */
  private showPeek(): void {
    const peer = this.peers.find((p) => p.at.open);
    if (!peer || this.popup.open) return this.hidePeek();
    if (!this.peek) {
      this.peekList = new Listbox(`${this.id}-peek`, this.multiple, null, null, (o, positions) => this.draw(o, positions, "row"));
      const body = el("div", { class: "erabi-popup-body erabi-peek", "aria-hidden": "true" }, this.peekList.el);
      this.peekList.el.removeAttribute("role");
      this.peekList.el.removeAttribute("tabindex");
      this.el.append(body);
      this.peek = new Popup(this.field, body, () => {}, { sheet: "never" });
    }
    const saved = this.query;
    this.query = "";
    const rows = this.rows();
    this.query = saved;
    const active = rows.findIndex((row) => row.type === "option" && row.option.value === peer.at.option);
    this.peek.el.style.setProperty("--erabi-peer", peer.color);
    this.peek.show();
    this.peekList!.setRows(rows, active);
    this.peek.place();
  }

  private hidePeek(): void {
    this.peek?.hide();
  }

  // -- For others (Erabi.Live, a grid's editor) ---------------------------

  focus(): void {
    this.control.focus();
  }

  /** Types into the picker, as a person would: the box of the field, or of its list. */
  type(text: string): void {
    const box = this.input ?? this.filterInput;
    if (!box) {
      for (const char of text) this.typeahead(char);
      return;
    }
    if (!this.popup.open) this.open();
    box.value = text;
    box.focus();
    this.setQuery(text);
  }

  /** Whether a node is the picker's: its popup is in the top layer, but inside its element. */
  contains(node: Node | null): boolean {
    return !!node && this.el.contains(node);
  }

  /** An answer of an async search (Erabi.Live), pushed after the reply. */
  receive(payload: Record<string, unknown>): void {
    this.search?.receive(payload);
  }

  /** Forgets the cached answers of the search (the options on the server changed). */
  refreshSearch(): void {
    this.search?.clear();
    this.results = null;
    if (this.popup.open) this.search?.run(this.query.trim());
  }

  destroy(): void {
    for (const cleanup of this.cleanups) cleanup();
    this.cleanups = [];
    if (this.placeTimer) clearTimeout(this.placeTimer);
    this.peek?.destroy();
    this.popup.destroy();
    this.search?.destroy();
  }
}

const PALETTE = new Set(["gray", "brown", "orange", "yellow", "green", "blue", "purple", "pink", "red"]);

/** A color of the palette by its custom property, or a CSS color as it is. */
function paletteColor(color: string): string {
  return PALETTE.has(color) ? `var(--erabi-${color}-text)` : color;
}

/** A label with the matched characters (by code point index) marked. */
export function highlight(label: string, positions: number[]): Node[] {
  if (positions.length === 0) return [document.createTextNode(label)];
  const chars = Array.from(label);
  const marked = new Set(positions);
  const nodes: Node[] = [];
  let run = "";
  let inMark = false;
  const flush = () => {
    if (!run) return;
    nodes.push(inMark ? el("mark", { class: "erabi-match" }, run) : document.createTextNode(run));
    run = "";
  };
  chars.forEach((char, index) => {
    const mark = marked.has(index);
    if (mark !== inMark) {
      flush();
      inMark = mark;
    }
    run += char;
  });
  flush();
  return nodes;
}
