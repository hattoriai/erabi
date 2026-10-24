# Erabi

![Erabi — Pickers for Phoenix](https://raw.githubusercontent.com/hattoriai/erabi/main/media/banner.png)

Erabi (選び, "choosing") is pickers for Phoenix LiveView: the counterpart
to [Koyomi](https://hex.pm/packages/koyomi) for everything that is not a
date. It gives your app:

* `select`, `multi_select`, `combobox`, `tags`, `person_picker`,
  `color_picker`, `emoji_picker` and `icon_picker`, each a
  field of a form that posts what the browser's own `<select>` would, and
  that is that `<select>` until its hook mounts (and with JavaScript off);
* options as you have them: `["a", "b"]`, `[{"To do", :todo}]`, a keyword
  list, maps with colors, hints, icons and groups, your user structs;
* colored options from a palette of nine, each pair of chip and text
  checked for contrast in light and dark (WCAG AAA), and your own CSS
  colors;
* people and agents: avatars (an image, or initials on the person's
  color), agents marked as such, and "me" first;
* a color picker: the palette's swatches, and with `custom` any color, in
  an OKLCH area that holds only colors a screen shows, a hex box, the
  eyedropper, recent colors and the contrast with a background;
* an emoji picker, as Notion's and Slack's: every emoji by category, a
  search in eight languages by name, tag and `:shortcode:` (the same on
  the server, for an agent's tool), skin tones, recent emoji, a preview,
  and a tab of your own icons; and an icon picker of your icons alone;
* tags that people type, with "Create “…”" under your rules (a pattern,
  lengths, how many);
* the same rules in the browser, as people choose, and on the server in
  `Erabi.Changeset`, held to the same answers by one fixture;
* search as people type: on the server (`search={&Cities.search/1}`, with
  `on_mount Erabi.Live` and no event clauses of yours), or in the browser
  for the options it has, ranked by the same matcher as Jumon's palette,
  with the matched letters marked;
* lists of thousands of options, drawn a screenful at a time;
* on phones, every popup a sheet from the bottom of the screen, above the
  keyboard, with Done and a swipe down to close;
* the keyboard and screen readers of the WAI-ARIA combobox and listbox
  patterns: arrows, Home and End, typeahead, Backspace on chips, Escape,
  announcements of what was added and removed;
* editors of a grid's cells, for [Masu](https://hex.pm/packages/masu)
  (`Erabi.cell_editor/2`);
* with [Issho](https://hex.pm/packages/issho), who else is choosing: the
  people and agents who have a picker open, the option each is on, and an
  agent that goes through the options before its change lands
  (`Erabi.Issho`);
* `Erabi.Test`, to choose and search in `Phoenix.LiveViewTest` with no
  browser.

The pickers are a prebuilt JavaScript bundle in the Hex package, 14 KB
gzipped; the color picker (6 KB) and the emoji and icon pickers (7 KB,
and their emoji as the picker first opens) are entries of their own, for
the apps that have them. Your app does not run Node.js for it: you add the
hook and one style sheet.

## What the pickers do

| | |
| --- | --- |
| Pickers | `select/1` (typeahead; a box to filter from 10 options), `multi_select/1` (chips; the list stays open), `combobox/1` (type to find; `create` keeps free text), `tags/1` (type, Enter or a comma; "Create “…”"), `person_picker/1` (avatars, agents, `me`, `multiple`), `color_picker/1` (swatches; `custom` for any color as `#rrggbb`), `emoji_picker/1` (search, categories, tones, recent; your icons in a tab), `icon_picker/1` |
| Options | anything a `<select>` takes; maps or `Erabi.Option` with `:label`, `:hint`, `:color`, `:icon`, `:avatar`, `:kind`, `:group`, `:keywords`, `:priority`, `:disabled` (or its reason); user structs by `:id` and `:name` |
| Forms | posts `name` (or `name[]`, after an empty one, so that none clears it), in the order chosen; `phx-change` and `phx-submit` as they are; errors with `aria-invalid` and `aria-describedby`; a `<label for>` names the picker |
| Rules | `required`, `min`, `max`, `create`, `min_length`, `max_length`, `pattern`: in the browser and in `Erabi.Changeset.validate_choice/4`, with Ecto's messages and `translate_error` |
| Search | a function of the query in the LiveView (`Erabi.Live`): pages of 50 as the list scrolls, `async` in a task, stale answers dropped, recent answers cached, a retry when one does not come |
| Matching | case, accents and width do not count; letters in order ("nwiss" finds "New issue"); word starts first; one typo in a word of four letters; keywords and hints too |
| Looks | chips in nine colors, avatars, icons drawn by your `:icon` slot, groups with headings, hints; light and dark; the Sumi theme |
| Accessibility | the WAI-ARIA combobox (select-only and editable) and listbox patterns, `aria-activedescendant`, typeahead, announcements, forced colors, reduced motion |
| Words | English, Portuguese, Spanish, French, German, Italian, Dutch and Japanese; yours with `messages` or Gettext |
| Choosing together | with Issho: the others who have a picker open on its field, their options marked, a peek of the list where they are; `Erabi.Issho.choose/5` for an agent to choose as people watch |
| Grids | `Erabi.cell_editor/2` and `erabiEditors()`: a picker as the editor of a Masu column |
| Testing | `Erabi.Test.choose/3`, `choices/2`, `chosen/2`, `search/3` |

## Install

Erabi needs Elixir 1.18 or later (it uses the built-in `JSON` module),
Phoenix 1.7.14 or 1.8, Phoenix LiveView 1.1 or later, and Ecto 3.13 or
later.

Add `erabi` to the deps in `mix.exs`:

```elixir
def deps do
  [
    {:erabi, "~> 0.2"}
  ]
end
```

Then run:

```sh
mix deps.get
mix erabi.install
```

The installer adds the hook to `assets/js/app.js` and the style sheet to
`assets/css/app.css`, and prints what it changed. Give `--dry-run` to see
the changes first. It does not add what a file already has, so you can
run it again.

### The manual steps

To make the same changes by hand, import the hook in `assets/js/app.js`
and add it to the hooks of the `LiveSocket`:

```js
import { Erabi } from "erabi"

const liveSocket = new LiveSocket("/live", Socket, {
  params: {_csrf_token: csrfToken},
  hooks: {...colocatedHooks, Erabi},
})
```

If you use `color_picker`, `emoji_picker` or `icon_picker` (or such a
column in Masu), import their entries too. They are bundles of their own
(6 and 7 KB gzipped), so that apps without them do not load them;
without the import, such a picker stays the browser's `<select>`, and
the console says what is missing:

```js
import "erabi/color"
import "erabi/emoji"
```

The emoji picker fetches its emoji (a file of the page's language) from
your endpoint; the installer adds the line that serves them, above the
endpoint's own `Plug.Static`:

```elixir
plug Plug.Static, at: "/erabi/emoji", from: {:erabi, "priv/emoji"}, gzip: true
```

Import the style sheet in `assets/css/app.css` (and the Sumi theme, if you
want it: Sumi is the design system of Hattori AI, the makers of Erabi,
Koyomi, Masu, Kotoba and Jumon; it follows Sumi's seven themes and their
accents). Put these lines below the other `@import`
lines of `app.css`:

```css
@import "../../deps/erabi/priv/static/erabi.css";
/* @import "../../deps/erabi/priv/static/erabi-sumi.css"; */
```

### `NODE_PATH=deps`

`import { Erabi } from "erabi"` resolves through the `NODE_PATH` of your
esbuild profile, which must have `deps/`. The Phoenix generators already
set it. If your profile has no `NODE_PATH`, add it in `config/config.exs`:

```elixir
env: %{"NODE_PATH" => [Path.expand("../deps", __DIR__), Mix.Project.build_path()]}
```

## Use

Import the components in the `html_helpers` of your web module:

```elixir
import Erabi.Components
```

Then, in a form:

```heex
<.select field={@form[:status]} options={@statuses} />
<.multi_select field={@form[:labels]} options={@labels} max={3} />
<.tags field={@form[:tags]} options={@tags} create />
<.person_picker field={@form[:owner_id]} people={@members} me={@current_user} />
<.color_picker field={@form[:color]} custom />
<.emoji_picker field={@form[:icon]} />
```

with options as the app has them:

```elixir
@statuses [
  %{value: :todo, label: "To do", color: :gray},
  %{value: :doing, label: "In progress", color: :yellow},
  %{value: :done, label: "Done", color: :green}
]
```

and the same rules in the changeset:

```elixir
def changeset(task, params) do
  task
  |> cast(params, [:status, :labels])
  |> Erabi.Changeset.validate_choice(:status, [required: true], options: @statuses)
  |> Erabi.Changeset.validate_choice(:labels, [max: 3], options: Labels.all())
end
```

A search on the server, as people type:

```elixir
on_mount Erabi.Live
```

```heex
<.combobox field={@form[:city_id]} search={&Places.cities/1} selected={@city} />
```

## Guides

* [Quickstart](guides/quickstart.md) - a first picker, step by step.
* [Pickers](guides/pickers.md) - the eight kinds, and their attributes.
* [Options](guides/options.md) - labels, colors, icons, groups, people.
* [Forms](guides/forms.md) - what a picker posts, changesets, errors, labels.
* [Rules](guides/rules.md) - the same rules in the browser and on the server.
* [Search](guides/server-search.md) - options from the server as people type.
* [Grids](guides/grids.md) - pickers as the editors of Masu's cells.
* [Choosing together](guides/choosing.md) - who else is choosing, with Issho; agents that choose as people watch.
* [Testing](guides/testing.md) - `Erabi.Test` in `Phoenix.LiveViewTest`.
* [Theming](guides/theming.md) - the custom properties, dark mode, the palette, Sumi.
* [Accessibility](guides/accessibility.md) - the keyboard and screen readers.
* [Known limits](guides/limits.md) - what Erabi does not do yet.

## Development

```sh
mix deps.get
mix erabi.build   # the bundle and the style sheets, into priv/static
mix dev           # every picker at http://localhost:4099
```

### Tests

```sh
mix test                   # Elixir
mix test --include build   # the build and the package
mix test.js                # the browser's matcher and rules
mix test.e2e               # the pickers in Chromium, Firefox and WebKit
```

The rules and the matcher that both the server and the browser apply are
tested on both sides with one fixture each: `test/fixtures/rules.json`,
and `test/fixtures/match.json`, which is Jumon's.

### Release

`mix release` builds the bundle, checks `priv/static` and the version of
`package.json`, publishes to Hex and tags the version.

## Contributing

See [CONTRIBUTING.md](https://github.com/hattoriai/erabi/blob/main/CONTRIBUTING.md): when a change needs an issue
first, and what a pull request needs.

## License

Erabi is released under the MIT License. See `LICENSE`. Its icons are
Lucide's (ISC). See `NOTICE`.
