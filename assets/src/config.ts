// What the server sends a picker (Erabi.Components): its kind, options,
// rules and words, in `data-config`; its value in `data-value`.

import type { Rules } from "./rules";

export type Kind = "select" | "multi_select" | "combobox" | "tags" | "person";

/** An option as the server sends it (Erabi.Option.to_wire/1). */
export interface WireOption {
  /** The value, as the form posts it. */
  v: string;
  /** The label. */
  l: string;
  h?: string;
  c?: string;
  i?: string;
  a?: string;
  /** A person's kind: "human" or "agent". */
  p?: "human" | "agent";
  g?: string;
  k?: string[];
  r?: number;
  d?: boolean | string;
}

/** An option as a picker holds it. */
export interface Option {
  value: string;
  label: string;
  hint?: string;
  color?: string;
  icon?: string;
  avatar?: string;
  person?: "human" | "agent";
  group?: string;
  keywords?: string[];
  priority?: number;
  disabled?: boolean | string;
  /** Not an option of the server's: typed by the person, as a new value. */
  created?: boolean;
}

export function option(wire: WireOption): Option {
  return {
    value: wire.v,
    label: wire.l,
    hint: wire.h,
    color: wire.c,
    icon: wire.i,
    avatar: wire.a,
    person: wire.p,
    group: wire.g,
    keywords: wire.k,
    priority: wire.r,
    disabled: wire.d,
  };
}

export interface Config {
  v: 1;
  id: string;
  kind: Kind;
  multiple: boolean;
  options: WireOption[];
  /** Options of the chosen values that are not among `options` (a search's). */
  selected?: WireOption[];
  rules: Rules;
  messages: Record<string, string>;
  locale: string;
  label?: string;
  labelId?: string;
  describedBy?: string;
  invalid?: boolean;
  placeholder?: string;
  /** Whether the options come from a search on the server (Erabi.Live). */
  search?: boolean;
  /** Whether the list has a box to filter it. */
  filter?: boolean;
  clearable?: boolean;
  disabled?: boolean;
  readonly?: boolean;
  /** The value of the person who is "me", listed first. */
  me?: string;
  onChange?: string;
  /** The icons the app drew, by name, in <template data-erabi-icon>. */
  icons?: boolean;
}

export function readConfig(el: HTMLElement): Config {
  return JSON.parse(el.dataset.config ?? "{}") as Config;
}

export function readValue(el: HTMLElement): string[] {
  try {
    const value = JSON.parse(el.dataset.value ?? "[]") as unknown;
    return Array.isArray(value) ? value.map(String).filter((v) => v !== "") : [];
  } catch {
    return [];
  }
}

/** The words of a picker, with placeholders and plural forms. */
export class Words {
  private plurals: Intl.PluralRules;

  constructor(
    private messages: Record<string, string>,
    readonly locale: string,
  ) {
    this.plurals = new Intl.PluralRules(locale);
  }

  t(key: string, vars: Record<string, string | number> = {}): string {
    const text = this.messages[key] ?? key;
    return text.replace(/\{(\w+)\}/g, (match, name: string) => (name in vars ? String(vars[name]) : match));
  }

  /** The plural form of `base` for `n` (`resultsOne`, `resultsOther`), with `{n}` filled. */
  count(base: string, n: number, vars: Record<string, string | number> = {}): string {
    const form = this.plurals.select(n) === "one" ? "One" : "Other";
    return this.t(base + form, { n: new Intl.NumberFormat(this.locale).format(n), ...vars });
  }
}
