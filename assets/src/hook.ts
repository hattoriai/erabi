// The Erabi hook for a LiveSocket, and `mountErabi` for a page without
// LiveView. The hook makes a Picker of its element, gives it the server's
// later renders (`updated`), and passes the events of Erabi.Live
// (erabi:set, erabi:results, erabi:refresh, erabi:open, erabi:close,
// erabi:focus) to the picker they name.

import { readConfig } from "./config";
import { isSeparate, kindOf, type AnyPicker } from "./kinds";
import { Picker, type Transport } from "./picker";

/**
 * The picker of an element, by its kind; none for a kind of an entry the
 * app did not import, which stays the browser's <select>.
 */
function make(el: HTMLElement, transport: Transport | null): AnyPicker | undefined {
  const kind = readConfig(el).kind;
  if (!isSeparate(kind)) return new Picker(el, transport);
  const Kind = kindOf(kind);
  return Kind ? new Kind(el, transport) : undefined;
}

interface HookContext {
  el: HTMLElement;
  pushEvent(event: string, payload: object, onReply?: (reply: Record<string, unknown>, ref: number) => void): void;
  pushEventTo(target: string | HTMLElement, event: string, payload: object, onReply?: (reply: Record<string, unknown>, ref: number) => void): void;
  handleEvent(event: string, callback: (payload: Record<string, unknown>) => void): void;
}

interface ErabiHook extends HookContext {
  picker?: AnyPicker;
}

const SERVER_EVENTS = ["erabi:set", "erabi:results", "erabi:refresh", "erabi:open", "erabi:close", "erabi:focus", "erabi:people"];

function onServerEvent(picker: AnyPicker, event: string, payload: Record<string, unknown>): void {
  if (payload.id !== picker.id) return;
  switch (event) {
    case "erabi:set":
      picker.set(((payload.value ?? []) as unknown[]).map(String));
      break;
    case "erabi:results":
      if (picker instanceof Picker) picker.receive(payload);
      break;
    case "erabi:refresh":
      if (picker instanceof Picker) picker.refreshSearch();
      break;
    case "erabi:open":
      picker.open();
      break;
    case "erabi:close":
      picker.close(false);
      break;
    case "erabi:focus":
      picker.focus();
      break;
    case "erabi:people":
      if (picker instanceof Picker) picker.setPeers((payload.people ?? []) as Parameters<Picker["setPeers"]>[0], (payload.holder ?? null) as Parameters<Picker["setPeers"]>[1]);
      break;
  }
}

export const Erabi = {
  mounted(this: ErabiHook) {
    const hook = this;
    const target = hook.el.getAttribute("phx-target");
    const transport: Transport = {
      push(event, payload, onReply) {
        const reply = onReply ? (response: Record<string, unknown>) => onReply(response) : undefined;
        // A search runs in the LiveView (Erabi.Live), wherever the picker is.
        if (target && event !== "erabi:search") hook.pushEventTo(target, event, payload, reply);
        else hook.pushEvent(event, payload, reply);
      },
      pushTo(selector, event, payload) {
        hook.pushEventTo(selector, event, payload);
      },
    };
    hook.picker = make(hook.el, transport);
    for (const event of SERVER_EVENTS) {
      hook.handleEvent(event, (payload) => {
        if (hook.picker) onServerEvent(hook.picker, event, payload);
      });
    }
  },

  updated(this: ErabiHook) {
    this.picker?.update();
  },

  destroyed(this: ErabiHook) {
    this.picker?.destroy();
    this.picker = undefined;
  },
};

const mounted = new WeakMap<HTMLElement, AnyPicker>();

/**
 * Mounts the pickers under `root` on a page without a LiveSocket (a
 * controller's template): the same pickers, without a search on the
 * server. Returns them; a picker already mounted is skipped.
 */
export function mountErabi(root: ParentNode = document): AnyPicker[] {
  const pickers: AnyPicker[] = [];
  for (const element of root.querySelectorAll<HTMLElement>('[phx-hook="Erabi"]')) {
    if (mounted.has(element)) continue;
    const picker = make(element, null);
    if (!picker) continue;
    mounted.set(element, picker);
    pickers.push(picker);
  }
  return pickers;
}
