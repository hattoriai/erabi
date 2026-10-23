// The emoji search, the same in Erabi.Emoji: each word of the query
// starts a word of the emoji's name, or of one of its keywords (tags and
// shortcodes), case, accents and width aside. A word of the name counts
// more than a keyword's, a whole word more than its start, a shortcode
// that is the word most of the words, and a name that is the query (or
// starts with it) most of all; shorter names first, then Unicode's
// order. In Japanese and Chinese, which do not put spaces between words,
// a word may be anywhere in a name or keyword. Words are found by their start, not with typos: with
// 2,000 emoji and 20,000 keywords, that keeps each key under a few ms.

import { internal } from "erabi";

// The main bundle's (see emoji-entry.ts).
const { fold } = internal;

/** What the search needs of an emoji, folded once. */
export interface Searchable {
  label: string;
  keywords: string[];
  /** GitHub's shortcode ("tada"), or "". */
  code?: string;
}

export interface Folded {
  code: string;
  name: string;
  nameWords: string[];
  keywords: string[];
  keywordWords: string[];
}

const split = (text: string) => text.split(/[^\p{L}\p{N}_+]+/u).filter((w) => w !== "");

export function foldEmoji(e: Searchable): Folded {
  const name = fold(e.label);
  const keywords = e.keywords.map(fold);
  return { code: fold(e.code ?? ""), name, nameWords: split(name), keywords, keywordWords: keywords.flatMap(split) };
}

const UNSPACED = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u;

function wordScore(f: Folded, word: string): number {
  if (f.code !== "" && f.code === word) return 36;
  let best = 0;
  for (const w of f.nameWords) {
    if (w === word) return 30;
    if (w.startsWith(word)) best = Math.max(best, 20);
  }
  for (const k of f.keywords) if (k === word) best = Math.max(best, 16);
  if (best < 12) for (const w of f.keywordWords) if (w.startsWith(word)) best = Math.max(best, w === word ? 14 : 10);
  if (best === 0 && UNSPACED.test(word) && (f.name.includes(word) || f.keywords.some((k) => k.includes(word)))) best = 8;
  return best;
}

/** The score of an emoji for a query (its words, folded), or 0 when it does not match. */
export function emojiScore(f: Folded, words: string[], whole: string): number {
  let total = 0;
  for (const word of words) {
    const s = wordScore(f, word);
    if (s === 0) return 0;
    total += s;
  }
  const extra = f.name === whole ? 100 : f.name.startsWith(whole) ? 40 : 0;
  return total + extra - Math.min(Array.from(f.name).length, 40) / 10;
}

/** The query's words, folded; and the whole query, folded. */
export function emojiQuery(query: string): [string[], string] {
  const whole = fold(query.trim());
  return [split(whole), split(whole).join(" ")];
}

/** The items that match a query, best first; a tie keeps their order. */
export function searchEmoji<T>(items: T[], folded: (item: T) => Folded, query: string): T[] {
  const [words, whole] = emojiQuery(query);
  if (words.length === 0) return items;
  const found: [T, number, number][] = [];
  items.forEach((item, index) => {
    const score = emojiScore(folded(item), words, whole);
    if (score > 0) found.push([item, score, index]);
  });
  found.sort((a, b) => b[1] - a[1] || a[2] - b[2]);
  return found.map(([item]) => item);
}
