// Small DOM helpers: elements from attributes and children, and the icons.

type Attrs = Record<string, string | null | undefined>;

/** An element with attributes (null and undefined are left out) and children. */
export function el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs = {}, ...children: (Node | string)[]): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [name, value] of Object.entries(attrs)) {
    if (value !== null && value !== undefined) node.setAttribute(name, value);
  }
  node.append(...children);
  return node;
}

const SVG = "http://www.w3.org/2000/svg";

// The icons are Lucide's (https://lucide.dev, ISC licence, see NOTICE): the
// SVG shapes of each, 24 × 24 and stroke only. The bundle does not import
// Lucide.
const ICONS = {
  /** Lucide `chevron-down`. */
  chevron: ["m6 9 6 6 6-6"],
  /** Lucide `x`. */
  close: ["M18 6 6 18", "m6 6 12 12"],
  /** Lucide `check`. */
  check: ["M20 6 9 17l-5-5"],
  /** Lucide `plus`. */
  plus: ["M5 12h14", "M12 5v14"],
  /** Lucide `search`. */
  search: ["m21 21-4.34-4.34", "M11 3a8 8 0 1 0 0 16 8 8 0 0 0 0-16z"],
} as const;

export type IconName = keyof typeof ICONS;

/** One of Erabi's own icons, hidden from screen readers. */
export function icon(name: IconName): SVGSVGElement {
  const svg = document.createElementNS(SVG, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("class", `erabi-icon erabi-icon-${name}`);
  for (const d of ICONS[name]) {
    const path = document.createElementNS(SVG, "path");
    path.setAttribute("d", d);
    svg.append(path);
  }
  return svg;
}

/** A person's initials, for an avatar without an image: "Ada Lovelace" is "AL". */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/u).filter(Boolean);
  const letters = words.length > 1 ? [words[0]!, words[words.length - 1]!] : words.slice(0, 1);
  return letters.map((word) => Array.from(word)[0]!.toLocaleUpperCase()).join("");
}

let counter = 0;

/** An id unique on the page, from a prefix. */
export function uid(prefix: string): string {
  counter += 1;
  return `${prefix}-${counter}`;
}
