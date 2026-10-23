// What a picker accepts: the same rules as Erabi.Rules on the server
// (test/fixtures/rules.json holds the two to the same answers).

/** The rules as the server sends them (Erabi.Rules.to_client/1). */
export interface Rules {
  required?: boolean;
  min?: number;
  max?: number;
  create?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
}

/** Why values are refused: a kind of Erabi.Rules.error, and what its message needs. */
export interface Refusal {
  kind: "required" | "too_few" | "too_many" | "not_allowed" | "too_short" | "too_long" | "format" | "duplicate";
  min?: number;
  max?: number;
  min_length?: number;
  max_length?: number;
  value?: string;
}

const segmenter = typeof Intl !== "undefined" && "Segmenter" in Intl ? new Intl.Segmenter(undefined, { granularity: "grapheme" }) : null;

/** The length of a text in characters as people count them (graphemes), as Elixir's String.length/1. */
export function length(text: string): number {
  if (!segmenter) return Array.from(text).length;
  let n = 0;
  for (const _ of segmenter.segment(text)) n++;
  return n;
}

const patterns = new Map<string, RegExp>();

function pattern(source: string): RegExp {
  let regex = patterns.get(source);
  if (!regex) {
    regex = new RegExp(`^(?:${source})$`, "u");
    patterns.set(source, regex);
  }
  return regex;
}

/** Checks a value that is not an option, as a person creates it: null, or why it cannot be. */
export function checkValue(rules: Rules, value: string): Refusal | null {
  const n = length(value);
  if (!rules.create) return { kind: "not_allowed", value };
  if (rules.minLength !== undefined && n < rules.minLength) return { kind: "too_short", min_length: rules.minLength, value };
  if (rules.maxLength !== undefined && n > rules.maxLength) return { kind: "too_long", max_length: rules.maxLength, value };
  if (rules.pattern !== undefined && !pattern(rules.pattern).test(value)) return { kind: "format", value };
  return null;
}

/**
 * Checks the values a picker posts: null, or the first reason they are
 * refused. `known` is the values of the options, or null when they are
 * not all known (a search).
 */
export function check(rules: Rules, values: string[], known: Iterable<string> | null): Refusal | null {
  const list = values.filter((value) => value !== "");
  const count = list.length;
  if (rules.required && count === 0) return { kind: "required" };
  if (rules.min !== undefined && count > 0 && count < rules.min) return { kind: "too_few", min: rules.min };
  if (rules.max !== undefined && count > rules.max) return { kind: "too_many", max: rules.max };
  const seen = new Set<string>();
  for (const value of list) {
    if (seen.has(value)) return { kind: "duplicate", value };
    seen.add(value);
  }
  if (known === null) return null;
  const options = known instanceof Set ? (known as Set<string>) : new Set(known);
  for (const value of list) {
    if (options.has(value)) continue;
    const refusal = checkValue(rules, value);
    if (refusal) return refusal;
  }
  return null;
}
