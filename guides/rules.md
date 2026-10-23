# Rules

A picker's rules hold in the browser, as people choose, and on the
server, in `Erabi.Changeset`. Give both the same `Erabi.Rules`:

```elixir
@tag_rules Erabi.Rules.new(max: 5, create: true, max_length: 24, pattern: "[\\p{L}\\p{N}][\\p{L}\\p{N} -]*")
```

```heex
<.tags field={@form[:tags]} options={@tags} rules={@tag_rules} />
```

```elixir
|> Erabi.Changeset.validate_choice(:tags, @tag_rules, options: @tags)
```

| Rule | |
| --- | --- |
| `required` | at least one value |
| `min`, `max` | how many values, for a picker of several |
| `create` | whether a value that is not an option may be chosen: typed as a new tag, or kept as text in a combobox |
| `min_length`, `max_length` | the length of a new value, in characters as people count them (graphemes: 👍🏽 is one) |
| `pattern` | a regular expression a new value must match, whole |

The attributes `required`, `min`, `max` and `create` are shortcuts over
`rules`.

## In the browser

The browser is a convenience: it does not add a value past `max` (the
other options say why), and its "Create “…”" row says why a value cannot
be created, as people type. The server checks again: a form can be
posted by anything.

## On the server

`Erabi.Changeset.validate_choice/4` adds at most one error, with
`validation: :erabi` and `kind:`, and the count that Ecto's messages use,
so that your app's `translate_error/1` translates it:

| Kind | Message |
| --- | --- |
| `:required` | can't be blank |
| `:too_few`, `:too_many` | should have at least (at most) %{count} values |
| `:not_allowed` | is not one of the options |
| `:too_short`, `:too_long` | should be at least (at most) %{count} characters |
| `:format` | has invalid format |
| `:duplicate` | has a value twice |

`:message` takes one message, or a map by kind.

## The same answers

`assets/src/rules.ts` and `Erabi.Rules` answer every case of
`test/fixtures/rules.json` the same way: counts, duplicates, values that
are not options, lengths of graphemes, and patterns.

A pattern runs as `RegExp` with the `u` flag in the browser and as a PCRE
with `u` on the server: keep to what both have (classes, ranges, `\d`,
`\w`, `\s`, `\p{L}`, counts, alternatives). `Erabi.Rules.new/1` takes the
pattern as text, not a `~r//`, for that reason.
