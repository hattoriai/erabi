# Pickers

Five pickers, in `Erabi.Components`, with the same attributes.

## `select`

One value from a list, as a `<select>`: a box that opens the list. With
the field focused, the arrows open it and move, Enter and Space choose,
and letters move to the option that starts with them (typeahead). A list
of 10 options or more has a box to filter it (`filter={false}` takes it
away; `filter` adds it to a shorter list).

```heex
<.select field={@form[:priority]} options={@priorities} />
```

## `multi_select`

Several values, shown as chips. The list stays open as people check and
uncheck; Backspace on the field takes the last chip back, and a chip's ×
takes it. `min` and `max` count the values: past `max`, the other options
cannot be chosen, and say why.

```heex
<.multi_select field={@form[:labels]} options={@labels} max={3} />
```

## `combobox`

A box to type in that suggests options as people type, and takes one.
The chosen option's label is in the box. With `create`, what people type
is kept as it is when they leave the box, under the rules (see
[Rules](rules.md)): a "city, or any place" field.

```heex
<.combobox field={@form[:city]} options={@cities} />
<.combobox field={@form[:place]} options={@cities} create />
```

## `tags`

Chips that people type. Suggestions come as they type; Enter takes the
active one, a comma takes what they typed; with `create`, "Create “…”" is
at the end of the list, refused with the reason when the rules say no (a
`pattern`, a length).

```heex
<.tags field={@form[:tags]} options={@tags} create max_length={24} />
```

## `person_picker`

People and agents: avatars (an image, or initials on the person's color),
agents with a rounded avatar and a badge, `me` first and marked. One
person, or several with `multiple`.

```heex
<.person_picker field={@form[:owner_id]} people={@members} me={@current_user} />
<.person_picker field={@form[:reviewer_ids]} people={@members} me={@current_user} multiple />
```

People are maps or structs with `:id` and `:name`, and `:avatar`,
`:color`, `:kind` (`:human` or `:agent`) when they have them: your users,
and Issho's actors, as they are. See [Options](options.md).

## `color_picker`

The color picker is an entry of its own, which the app imports with the
hook (`import "erabi/color"`): apps without one do not load it.

A color: swatches of a palette, and, with `custom`, any color. The
palette is Erabi's nine option colors by default, posted by name
(`"blue"`) and drawn as the chips they make, so that a label's color
reads the same where it is chosen and where it shows; or your colors, as
options.

```heex
<.color_picker field={@form[:color]} />
<.color_picker field={@form[:brand]} palette={[{"Ocean", "#3f6f8f"}, {"Sand", "#d8c3a5"}]} custom contrast="#ffffff" />
```

With `custom`, the popup has an area of lightness and chroma for a hue,
and a hue slider, in OKLCH, which follows how people see colors: each row
of the area runs out to the most chroma a screen shows, so every point is
a color it can show. Then a hex box, the browser's eyedropper where it
has one (Chromium), and the person's recent colors (kept in the browser).
A custom color posts as `#rrggbb`; `custom` is the rules' `create`, with
a `pattern` of six hex digits, which the changeset takes too:

```elixir
|> Erabi.Changeset.validate_choice(:color, [], options: Erabi.Option.colors())
|> Erabi.Changeset.validate_choice(:brand, create: true, pattern: "#[0-9a-fA-F]{6}")
```

`contrast` is the background the color is for: the custom colors show
their contrast ratio with it, and their WCAG grade.

The swatches are a listbox: arrows move between them in rows, Home and
End, Enter or Space takes one. The area and the hue are sliders: arrows
move by 1 (Shift, by 5 or 10), Enter takes the color and closes.

## `emoji_picker`

An emoji, as Notion's page icons and Slack's reactions take one: every
emoji by category, a search in the page's language, skin tones, the
person's recent emoji, and a preview of the one under the pointer or the
keyboard. It posts the emoji itself (`"🎉"`, in the chosen tone).

```heex
<.emoji_picker field={@form[:icon]} />
```

With `options` that have an `:icon`, drawn by the `:icon` slot, it has a
second tab, of your icons, which post their values:

```heex
<.emoji_picker field={@form[:icon]} options={@icons}>
  <:icon :let={name}><.icon name={"hero-" <> name} /></:icon>
</.emoji_picker>
```

The search finds an emoji by the start of a word of its name, its tags
or its `:shortcode:` (`"thu"`, `"+1"` and `":thumbsup:"` find 👍), in
English, Portuguese, Spanish, French, German, Italian, Dutch or Japanese,
and stays under a few milliseconds a key. Emoji newer than the device
draws are left out. `tones={false}` takes the skin tones away.

The emoji are a file of the page's language (about 60 KB compressed),
which the picker fetches as it first opens, or as the pointer comes near
it, and which the browser then keeps. `mix erabi.install` serves them
from your endpoint; see `Erabi.Emoji`. Check the value in the changeset
with `Erabi.Emoji.options/1`:

```elixir
|> Erabi.Changeset.validate_choice(:icon, [], options: Erabi.Emoji.options(@icons))
```

On the server, `Erabi.Emoji.find/2` searches as the picker does, and
`Erabi.Emoji.name/2` names an emoji: an agent's tool can choose an emoji
by what it means.

The keyboard: type to search; the arrows move in the grid, by rows across
categories; Enter takes the emoji; Escape clears the search, then closes.
The emoji and icon pickers are an entry of their own, which the app
imports with the hook (`import "erabi/emoji"`).

## `icon_picker`

One of your icons: the `options` that have an `:icon`, in a grid, with a
search by their labels and keywords. It posts the option's value.

```heex
<.icon_picker field={@form[:icon]} options={@icons}>
  <:icon :let={name}><.icon name={"hero-" <> name} /></:icon>
</.icon_picker>
```

## Attributes of every picker

| | |
| --- | --- |
| `field` | the form field, `@form[:status]`; or `name` and `value` |
| `id` | the picker's element; the field's id with `_picker` unless given |
| `options` | the options (see [Options](options.md)) |
| `selected` | options of chosen values that are not in `options` (a search's), for their labels |
| `search`, `async` | options from the server as people type (see [Search](server-search.md)) |
| `rules`, `required`, `min`, `max`, `create` | the rules (see [Rules](rules.md)) |
| `filter` | a box to filter the list; from 10 options unless given |
| `clearable` | a clear button on a picker of one value; unless `required` |
| `placeholder` | the words of an empty picker |
| `label_id`, `label` | the accessible name; a `<label for>` of the field works too |
| `disabled`, `readonly` | as on any field |
| `locale`, `messages` | the words (see `Erabi.Messages`) |
| `on_change` | an event the picker pushes on each change, outside a form |
| `sheet` | where the popup is a sheet from the bottom of the screen: on phones (`:auto`), `:always`, `:never`; `config :erabi, sheet:` for every picker |
| `:icon` slot | draws an option's `:icon` by its name |

## On phones

On a phone (a touch screen narrower than 640px, or shorter than 480px,
as a phone on its side), every picker's popup is a sheet from the bottom
of the screen, as the phone's own pickers are: over a dimmed page that
does not scroll, with the picker's name and a Done button, rows of
2.75rem, and as tall as the screen allows above the on-screen keyboard.
A combobox's or tags' box to type in moves into the sheet while it is
open, so that it stays above the keyboard. A tap on the dimmed page
(which then does nothing on the page), Done, or a swipe down from the
sheet's top closes it. Text boxes in a sheet are 16px at least, so that
the phone does not zoom in on them.

`sheet={:never}` keeps a picker a dropdown everywhere; `sheet={:always}`
makes it a sheet on every screen.

## Outside a form

A picker that is not in a form (a view switcher, a filter of a page)
pushes `on_change` with `%{"id" => id, "value" => value}`:

```heex
<.select name="view" value={@view} options={["Board", "List"]} label="View" on_change="view" />
```

## From the server

`Erabi.Live` sets a picker's value (`set/3`), opens and closes its list,
and moves the focus to it, for a value the server changed while the
picker is on the page.
