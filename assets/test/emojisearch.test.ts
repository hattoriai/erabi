import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { foldEmoji, searchEmoji } from "../src/emojisearch";

// The same queries as Erabi.EmojiTest: the browser and the server find the same.
type Row = [string, string, string[], number, number, string[] | 0, string];

function emoji(language: string) {
  const data = JSON.parse(readFileSync(`../priv/emoji/emoji-${language}.json`, "utf8")) as { emoji: Row[] };
  return data.emoji.map(([char, label, keywords, , , , code]) => ({ char, folded: foldEmoji({ label, keywords, code }) }));
}

const first = (language: string, query: string) => searchEmoji(emoji(language), (e) => e.folded, query)[0]?.char;

test("the search finds by name, tag and shortcode, in the page's language", () => {
  assert.equal(first("en", "thumbs up"), "👍");
  assert.equal(first("en", "+1"), "👍");
  assert.equal(first("en", ":tada:"), "🎉");
  assert.equal(first("en", "smile"), "😄");
  assert.equal(first("pt", "coração vermelho"), "❤️");
  assert.equal(first("ja", "ハート"), "♥️");
  assert.equal(first("en", "nothing like this"), undefined);
});

test("the browser ranks as the server does", () => {
  const all = emoji("en");
  const top = (query: string) =>
    searchEmoji(all, (e) => e.folded, query)
      .slice(0, 5)
      .map((e) => e.char);
  assert.deepEqual(top("party"), ["🎉", "🥳", "🪅", "🪇", "🪩"]);
  assert.deepEqual(top("cat"), ["🐈", "🐱", "😼", "😹", "🙀"]);
});
