# Changelog

All notable changes to Erabi are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and Erabi follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - Unreleased

### Added

- The pickers, in `Erabi.Components`: `select/1`, `multi_select/1`,
  `combobox/1`, `tags/1` and `person_picker/1`. Each is a field of a form
  that posts what the browser's own `<select>` would (`name[]` after an
  empty one, in the order chosen), and is that `<select>` before the hook
  mounts.
- Options as a `<select>` takes them, or richer (`Erabi.Option`): hints,
  colors from a palette of nine checked for contrast, icons drawn by the
  app's `:icon` slot, groups, keywords, priorities, disabled options with
  their reason; user structs by `:id` and `:name`.
- People and agents: avatars, agents marked, `me` first.
- `color_picker/1`: the palette's swatches (Erabi's nine by name, or the
  app's colors), and with `custom` any color as `#rrggbb`: an OKLCH area
  of lightness and chroma that holds only colors a screen shows, a hue
  slider, a hex box, the eyedropper, recent colors, and the contrast
  with a background (`contrast`). It is an entry of its own
  (`import "erabi/color"`), so that apps without one do not load it;
  without the import it stays the browser's `<select>`, and says so in
  the console.
- Color columns in Masu: `Erabi.cell_editor(:color, ...)`, saved as the
  popup closes; a select of the palette without `erabi/color`.
- Tags typed with Enter or a comma, and "Create “…”" under the rules.
- `Erabi.Rules`, the same in the browser and in
  `Erabi.Changeset.validate_choice/4`: required, counts, creation,
  lengths in graphemes, a pattern; held to the same answers by
  `test/fixtures/rules.json`.
- `Erabi.Match`, Jumon's matcher, in Elixir and in the browser.
- Search on the server as people type (`Erabi.Live`): pages, `async`,
  stale answers dropped, a cache of recent answers, a retry.
- Lists of thousands of options, drawn a screenful at a time.
- The WAI-ARIA combobox and listbox patterns, typeahead, announcements.
- Words in English, Portuguese, Spanish, French, German, Italian, Dutch
  and Japanese (`Erabi.Messages`).
- Editors of Masu's cells: `Erabi.cell_editor/2` and `erabiEditors()`.
- With Issho (`Erabi.Issho`, `issho` and `user` attributes): who else
  has a picker open, the option each is on, a read-only peek of the list
  where they are, one at a time (the first to open the list holds the
  picker's lock; `lock: false` for none), and `Erabi.Issho.choose/5` for
  an agent to go through the options before its change lands.
- `Erabi.Test`: `choose/3`, `choices/2`, `chosen/2`, `search/3`.
- The Sumi theme (`erabi-sumi.css`), dark mode, forced colors, reduced
  motion.
- `mix erabi.install`.
