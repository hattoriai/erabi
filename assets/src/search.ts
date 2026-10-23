// A search on the server (Erabi.Live): a request a moment after the
// person stops typing, with a ref, so that a late answer to an older query
// is dropped; the answers of recent queries kept, so that going back is
// instant; pages as the list scrolls; and a timeout, after which the
// person can try again.

import { option, type Option, type WireOption } from "./config";

export type Push = (event: string, payload: Record<string, unknown>, onReply?: (reply: Record<string, unknown>) => void) => void;

export interface Results {
  query: string;
  options: Option[];
  more: boolean;
  state: "done" | "loading" | "error";
}

const DEBOUNCE = 140;
const TIMEOUT = 8000;
const CACHE = 40;

export class Search {
  private ref = 0;
  private current: { ref: number; query: string; offset: number } | null = null;
  private cache = new Map<string, { options: Option[]; more: boolean }>();
  private debounce: ReturnType<typeof setTimeout> | null = null;
  private timeout: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private id: string,
    private push: Push | null,
    private onResults: (results: Results) => void,
  ) {}

  /** Searches for a query: at once from the cache, else after a pause in the typing. */
  run(query: string): void {
    if (this.debounce) clearTimeout(this.debounce);
    const cached = this.cache.get(query);
    if (cached) {
      this.current = null;
      this.onResults({ query, options: cached.options, more: cached.more, state: "done" });
      return;
    }
    this.onResults({ query, options: [], more: false, state: "loading" });
    this.debounce = setTimeout(() => this.request(query, 0), query === "" ? 0 : DEBOUNCE);
  }

  /** The next page of the current query, when it has one. */
  more(query: string): void {
    const cached = this.cache.get(query);
    if (!cached || !cached.more || this.current) return;
    this.request(query, cached.options.length);
  }

  /** Forgets the cached answers: the options on the server changed. */
  clear(): void {
    this.cache.clear();
  }

  private request(query: string, offset: number): void {
    if (!this.push) {
      this.onResults({ query, options: [], more: false, state: "error" });
      return;
    }
    this.ref += 1;
    const ref = this.ref;
    this.current = { ref, query, offset };
    if (this.timeout) clearTimeout(this.timeout);
    this.timeout = setTimeout(() => {
      if (this.current?.ref === ref) {
        this.current = null;
        this.onResults({ query, options: this.cache.get(query)?.options ?? [], more: false, state: "error" });
      }
    }, TIMEOUT);
    this.push("erabi:search", { v: 1, id: this.id, ref, query, offset }, (reply) => this.receive(reply));
  }

  /** An answer: the reply of the request, or a push of an async search. */
  receive(reply: Record<string, unknown>): void {
    const current = this.current;
    if (!current || reply.ref !== current.ref || reply.pending) return;
    this.current = null;
    if (this.timeout) clearTimeout(this.timeout);
    if (reply.error) {
      this.onResults({ query: current.query, options: this.cache.get(current.query)?.options ?? [], more: false, state: "error" });
      return;
    }
    const page = ((reply.options as WireOption[] | undefined) ?? []).map(option);
    const before = current.offset > 0 ? (this.cache.get(current.query)?.options ?? []) : [];
    const options = before.concat(page);
    const more = reply.more === true;
    if (this.cache.size >= CACHE) this.cache.delete(this.cache.keys().next().value!);
    this.cache.set(current.query, { options, more });
    this.onResults({ query: current.query, options, more, state: "done" });
  }

  destroy(): void {
    if (this.debounce) clearTimeout(this.debounce);
    if (this.timeout) clearTimeout(this.timeout);
    this.current = null;
  }
}
