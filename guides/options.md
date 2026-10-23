# Options

A picker takes its options as a `<select>` does, or richer.

```elixir
["Draft", "Published"]                         # values, shown as they are
[{"To do", :todo}, {"Done", :done}]            # {label, value}
[todo: "To do", done: "Done"]                  # value: label
[%{value: 7, label: "Ada", avatar: "/a.png"}]  # maps
[{"Fruit", ["Apple", "Pear"]}, {"Vegetable", ["Leek"]}]  # groups
```

The keys of an option map (see `Erabi.Option`):

| | |
| --- | --- |
| `:value` | what the form posts, as text: an atom's name, an integer's digits, a struct's `Phoenix.Param` |
| `:label` | the words shown and searched; the value as text unless given |
| `:hint` | words beside the label, searched after it ("Engineering", "P1") |
| `:color` | a chip's color: one of the palette's, or a CSS color |
| `:icon` | the name of an icon, drawn by the picker's `:icon` slot |
| `:avatar`, `:kind` | a person's image, and `:human` or `:agent` |
| `:group` | the heading the option is listed under |
| `:keywords` | other words that find it ("crimson" for Red) |
| `:priority` | added to its rank as people search |
| `:disabled` | `true`, or the reason, shown under it |

A struct of yours is an option by its `:id` and `:name`, so a list of
users is a list of options as it is.

Two options with the same value are an error, said when the picker
renders.

## Colors

The palette has nine colors: `:gray`, `:brown`, `:orange`, `:yellow`,
`:green`, `:blue`, `:purple`, `:pink` and `:red` (Kotoba's seven, and two
more). Each is a pair of a chip's background and its text, in light and
dark, checked for contrast: at least 6.8:1 in light and 8.8:1 in dark
(WCAG AAA). A colored option is a chip in the list and in the field.

A CSS color (`"#3f6f8f"`, `"oklch(60% 0.12 200)"`) mixes a chip from it.
Only plain colors pass: nothing that could close the style it goes in.

For a person, the color is their avatar's (the initials' ground); their
chip stays neutral.

## Icons

An option's `:icon` is a name; the picker's `:icon` slot draws it, once
for each name, as the app draws its icons:

```heex
<.select field={@form[:priority]} options={@priorities}>
  <:icon :let={name}><.icon name={"hero-#{name}"} class="size-4" /></:icon>
</.select>
```

## Groups

Options with a `:group` (or given as `{group, options}`) are listed under
their group's heading, in the order they come. As people type, the list
is one, by rank.

## People and agents

```elixir
[
  %{id: 1, name: "Ada Lovelace", color: "#a45537", avatar: "/avatars/ada.png"},
  %{id: 7, name: "Claude", kind: :agent, hint: "For Rui"}
]
```

An agent has a rounded square avatar and the "Agent" badge, as Issho
draws them. `me` (a person, or their id) is listed first and marked "Me".

## Matching

The browser ranks the options it has as people type, with
`Erabi.Match`'s rules (Jumon's): case, accents and width do not count;
each word of the query is found in order ("nwiss" finds "New issue");
the start of the label and of its words count most; a word of four
letters or more may have one typo; keywords, the hint and the group are
searched after the label. The matched letters are marked.
