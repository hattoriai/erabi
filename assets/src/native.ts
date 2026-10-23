// The native control of a picker: the <select> (or <input>) that the form
// posts. A picker writes its value into it and tells the form, so that
// phx-change sees each change, and a form without LiveView posts it.

import { el } from "./dom";

/** Writes values into a native control; `label` names an option the control does not have yet. */
export function writeNative(native: HTMLSelectElement | HTMLInputElement | null, values: string[], label: (value: string) => string, notify: boolean): void {
  if (!native) return;
  if (native instanceof HTMLSelectElement) {
    const have = new Set(Array.from(native.options, (o) => o.value));
    for (const value of values) {
      if (!have.has(value)) native.append(el("option", { value }, label(value)));
    }
    const chosen = new Set(values);
    for (const o of Array.from(native.options)) o.selected = o.value === "" ? chosen.size === 0 && !native.multiple : chosen.has(o.value);
    // A form posts a select's values in the order of its options: the
    // chosen ones go last, in the order people chose them.
    if (native.multiple) {
      for (const value of values) {
        const o = Array.from(native.options).find((x) => x.value === value);
        if (o) native.append(o);
      }
    }
  } else {
    native.value = values[0] ?? "";
  }
  if (notify) {
    native.dispatchEvent(new Event("input", { bubbles: true }));
    native.dispatchEvent(new Event("change", { bubbles: true }));
  }
}
