// Makes the emoji data of the emoji picker, one file a language, from
// emojibase-data (MIT): ../priv/emoji/emoji-<language>.json, and its .gz.
// Run it when emojibase-data changes (npm run emoji); the files are
// committed, as data.
//
// A file: {v, version, groups, tones, emoji}, where `emoji` is a list of
// [emoji, label, keywords, group, unicode version, tones, shortcode], in
// Unicode's order: `keywords` are the language's tags and GitHub's
// shortcodes, `tones` the five skin tones of the emoji (or 0), and
// `shortcode` GitHub's first (or "").

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";

const LANGUAGES = ["en", "pt", "es", "fr", "de", "it", "nl", "ja"];
const base = "node_modules/emojibase-data";
const read = (path) => JSON.parse(readFileSync(`${base}/${path}`, "utf8"));
const { version } = read("package.json");
const out = "../priv/emoji";
mkdirSync(out, { recursive: true });

const data = read("en/data.json");
const github = read("en/shortcodes/github.json");
const COMPONENT = 2;

for (const language of LANGUAGES) {
  const local = new Map(read(`${language}/compact.json`).map((e) => [e.hexcode, e]));
  const messages = read(`${language}/messages.json`);
  const groups = messages.groups.map((g) => (g.order === COMPONENT ? null : g.message));
  const toneNames = ["light", "medium-light", "medium", "medium-dark", "dark"].map((key) => messages.skinTones.find((t) => t.key === key).message);

  const emoji = data
    .filter((e) => e.group !== undefined && e.group !== COMPONENT)
    .sort((a, b) => a.order - b.order)
    .map((e) => {
      const here = local.get(e.hexcode) ?? {};
      const codes = [github[e.hexcode] ?? []].flat();
      const keywords = [...new Set([...(here.tags ?? e.tags ?? []), ...codes])];
      // The five tones of one person; not the pairs of two people's.
      const tones = (e.skins ?? []).filter((s) => typeof s.tone === "number");
      return [e.emoji, here.label ?? e.label, keywords, e.group, e.version, tones.length === 5 ? tones.map((s) => s.emoji) : 0, codes[0] ?? ""];
    });

  const json = JSON.stringify({ v: 1, version, groups, tones: toneNames, emoji });
  writeFileSync(`${out}/emoji-${language}.json`, json);
  writeFileSync(`${out}/emoji-${language}.json.gz`, gzipSync(json, { level: 9 }));
  console.log(`emoji-${language}.json: ${emoji.length} emoji, ${json.length} bytes, ${gzipSync(json, { level: 9 }).length} gzipped`);
}
