// Pickers as editors of a grid's cells (Masu's `configure({editors})`):
// a picker drawn over the cell, its list open, its value saved as a
// grid saves its own editors'. The options, rules and words come from
// the column (`Erabi.cell_editor/2` on the server).

import type { Config, Kind, WireOption } from "./config";
import { el, uid } from "./dom";
import { isSeparate, kindOf, type AnyPicker } from "./kinds";
import { Picker } from "./picker";
import type { Rules } from "./rules";

type CellValue = unknown;

/** What Masu gives an editor (its CellEditorContext). */
export interface CellEditorContext {
  element: HTMLElement;
  value: CellValue;
  text: string | null;
  options: Record<string, unknown>;
  label: string;
  locale: string | null;
  commit(value: CellValue, move?: "down" | "up" | "right" | "left"): void;
  cancel(): void;
}

/** What Masu wants of an editor (its CellEditor). */
export interface CellEditor {
  focus(): void;
  value(): CellValue;
  contains(node: Node): boolean;
  destroy(): void;
}

const KINDS: Kind[] = ["select", "multi_select", "combobox", "tags", "person", "color", "emoji"];

/** The options of `Erabi.cell_editor/2`, as the column gives them. */
interface EditorOptions {
  options?: WireOption[];
  rules?: Rules;
  messages?: Record<string, string>;
  multiple?: boolean;
  filter?: boolean;
  me?: string;
  placeholder?: string;
  /** A color picker's background, for the contrast of custom colors. */
  contrast?: string;
  /** An emoji picker's data (Erabi.Emoji.url/1). */
  emojiData?: string;
  noTones?: boolean;
}

function values(value: CellValue): string[] {
  const list = Array.isArray(value) ? value : value === null || value === undefined ? [] : [value];
  return list.map((v) => String(v)).filter((v) => v !== "");
}

/** An editor of cells for a kind of picker. */
export function cellEditor(kind: Kind): (context: CellEditorContext) => CellEditor {
  return (context) => {
    const options = context.options as EditorOptions;
    const multiple = kind === "multi_select" || kind === "tags" || (kind === "person" && !!options.multiple);
    const id = uid("erabi-cell");
    const config: Config = {
      v: 1,
      id,
      kind,
      multiple,
      options: options.options ?? [],
      rules: options.rules ?? {},
      messages: options.messages ?? {},
      locale: context.locale ?? "en",
      label: context.label,
      filter: options.filter ?? (options.options ?? []).length >= 10,
      clearable: !multiple,
      me: options.me,
      placeholder: options.placeholder,
      contrast: options.contrast,
      emojiData: options.emojiData,
      noTones: options.noTones,
    };
    // A picker of an entry the app did not import ("erabi/color",
    // "erabi/emoji") is a select of its options.
    const Separate = isSeparate(kind) ? kindOf(kind) : null;
    if (isSeparate(kind) && !Separate) config.kind = "select";
    const host = el("div", { id, class: `erabi erabi-${config.kind} erabi-cell`, "data-config": JSON.stringify(config), "data-value": JSON.stringify(values(context.value)) });
    context.element.append(host);
    const picker: AnyPicker = Separate ? new Separate(host, null) : new Picker(host, null);

    if (Separate && kind === "emoji") {
      // An emoji is saved as it is chosen; closed with none, the edit is cancelled.
      let chosen = false;
      host.addEventListener("erabi:change", () => {
        chosen = true;
        context.commit(picker.get()[0] ?? null);
      });
      host.addEventListener("erabi:closed", () => {
        if (!chosen) context.cancel();
      });
    } else if (Separate) {
      // A color is saved as its popup closes, so that a drag in its area
      // saves once; closed with no change, the edit is cancelled.
      const before = values(context.value)[0] ?? null;
      host.addEventListener("erabi:closed", () => {
        const after = picker.get()[0] ?? null;
        if (after === before) context.cancel();
        else context.commit(after);
      });
    } else {
      // One value is saved as soon as it is chosen; several, when the editor closes.
      host.addEventListener("erabi:change", () => {
        if (!multiple) context.commit(picker.get()[0] ?? null);
      });
    }

    requestAnimationFrame(() => {
      picker.focus();
      picker.open();
      if (context.text) picker.type(context.text);
    });

    return {
      focus: () => picker.focus(),
      value: () => (multiple ? picker.get() : (picker.get()[0] ?? null)),
      contains: (node) => picker.contains(node),
      destroy: () => {
        picker.destroy();
        host.remove();
      },
    };
  };
}

/**
 * The cell editors of every kind, by the names that `Erabi.cell_editor/2`
 * gives a column: `configure({editors: {...erabiEditors()}})`.
 */
export function erabiEditors(): Record<string, (context: CellEditorContext) => CellEditor> {
  return Object.fromEntries(KINDS.map((kind) => [`erabi_${kind}`, cellEditor(kind)]));
}
