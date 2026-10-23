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

## Attributes of every picker

| | |
| --- | --- |
| `field` | the form field, `@form[:status]`; or `name` and `value` |
| `id` | the picker's element; the field's id with `_picker` unless given |
| `options` | the options (see [Options](options.md)) |
| `selected` | options of chosen values that are not in `options` (a search's), for their labels |
| `search`, `async` | options from the server as people type (see [Search](search.md)) |
| `rules`, `required`, `min`, `max`, `create` | the rules (see [Rules](rules.md)) |
| `filter` | a box to filter the list; from 10 options unless given |
| `clearable` | a clear button on a picker of one value; unless `required` |
| `placeholder` | the words of an empty picker |
| `label_id`, `label` | the accessible name; a `<label for>` of the field works too |
| `disabled`, `readonly` | as on any field |
| `locale`, `messages` | the words (see `Erabi.Messages`) |
| `on_change` | an event the picker pushes on each change, outside a form |
| `:icon` slot | draws an option's `:icon` by its name |

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
