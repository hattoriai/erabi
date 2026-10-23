// The Erabi hook for a LiveSocket, and `mountErabi` for a page without
// LiveView. The hook makes a Picker of its element, gives it the server's
// later renders (`updated`), and passes the events of Erabi.Live
// (erabi:set, erabi:results, erabi:refresh, erabi:open, erabi:close,
// erabi:focus) to the picker they name.

import { Picker, type Transport } from "./picker";

interface HookContext {
  el: HTMLElement;
  pushEvent(event: string, payload: object, onReply?: (reply: Record<string, unknown>, ref: number) => void): void;
  pushEventTo(target: string | HTMLElement, event: string, payload: object, onReply?: (reply: Record<string, unknown>, ref: number) => void): void;
  handleEvent(event: string, callback: (payload: Record<string, unknown>) => void): void;
}

interface ErabiHook extends HookContext {
  picker?: Picker;
}

const SERVER_EVENTS = ["erabi:set", "erabi:results", "erabi:refresh", "erabi:open", "erabi:close", "erabi:focus"];

function onServerEvent(picker: Picker, event: string, payload: Record<string, unknown>): void {
  if (payload.id !== picker.id) return;
  switch (event) {
    case "erabi:set":
      picker.set(((payload.value ?? []) as unknown[]).map(String));
      break;
    case "erabi:results":
      picker.receive(payload);
      break;
    case "erabi:refresh":
      picker.refreshSearch();
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
    };
    hook.picker = new Picker(hook.el, transport);
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

const mounted = new WeakMap<HTMLElement, Picker>();

/**
 * Mounts the pickers under `root` on a page without a LiveSocket (a
 * controller's template): the same pickers, without a search on the
 * server. Returns them; a picker already mounted is skipped.
 */
export function mountErabi(root: ParentNode = document): Picker[] {
  const pickers: Picker[] = [];
  for (const element of root.querySelectorAll<HTMLElement>('[phx-hook="Erabi"]')) {
    if (mounted.has(element)) continue;
    const picker = new Picker(element, null);
    mounted.set(element, picker);
    pickers.push(picker);
  }
  return pickers;
}
