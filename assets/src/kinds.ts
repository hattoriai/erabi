// The pickers that live in entries of their own ("erabi/color",
// "erabi/emoji"): each
// registers its kind here when the app imports it, and the hook and the
// cell editors make it by its kind. A page that has none of them does not
// load their code.

import type { Transport } from "./picker";

/** What the hook and the cell editors use of a picker. */
export interface AnyPicker {
  readonly id: string;
  get(): string[];
  set(value: string[]): void;
  update(): void;
  open(): void;
  close(restore: boolean): void;
  focus(): void;
  /** Starts with what a person typed on a grid's cell. */
  type(text: string): void;
  contains(node: Node | null): boolean;
  destroy(): void;
}

export type PickerClass = new (el: HTMLElement, transport: Transport | null) => AnyPicker;

const kinds = new Map<string, PickerClass>();

/** The entries that hold the kinds that are not in the main bundle. */
const ENTRIES: Record<string, string> = { color: "erabi/color", emoji: "erabi/emoji", icon: "erabi/emoji" };

/** Registers a kind of picker, from its entry. */
export function registerKind(kind: string, picker: PickerClass): void {
  kinds.set(kind, picker);
}

const warned = new Set<string>();

/** The picker of a kind from an entry of its own, or null (said once) when the app did not import it. */
export function kindOf(kind: string): PickerClass | null {
  const picker = kinds.get(kind);
  if (picker) return picker;
  if (kind in ENTRIES && !warned.has(kind)) {
    warned.add(kind);
    console.warn(`Erabi: the ${kind} picker is in its own entry; add \`import "${ENTRIES[kind]}"\` next to your import of "erabi". Until then it is the browser's <select>.`);
  }
  return null;
}

/** Whether a kind is one of an entry of its own. */
export function isSeparate(kind: string): boolean {
  return kind in ENTRIES;
}
