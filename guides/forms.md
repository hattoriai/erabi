# Forms

## What a picker posts

A picker posts what the browser's own `<select>` would:

* a picker of one value: `task[status]=doing`, or `task[status]=` when it
  is empty;
* a picker of several: `task[labels][]=` and then one `task[labels][]`
  for each value, in the order people chose them. The empty one first
  means that a picker with no value clears the field, as a list of
  checkboxes with a hidden input does.

So the params cast into an `Ecto.Enum`, an `:integer` id, a `:string`,
or an `{:array, _}` field, with `cast/3` as they are.

The picker writes its value into a native `<select>` and tells the form
(`input` and `change` events), so `phx-change` sees each change, and a
form without LiveView posts it.

## Before the hook mounts

Until its hook mounts (and with JavaScript off), the picker *is* that
`<select>`: its options, its value, `required`, `disabled`. Once the
picker is ready, the `<select>` stays in the form, out of sight, out of
the tab order and hidden from screen readers, and keeps posting.

## Changesets

`Erabi.Changeset.validate_choice/4` checks the picker's rules on the
server (see [Rules](rules.md)). Give it the options the value must be
among, or a function of the posted values for options that come from a
search:

```elixir
|> Erabi.Changeset.validate_choice(:status, [required: true], options: @statuses)
|> Erabi.Changeset.validate_choice(:owner_id, [], options: &Accounts.existing_ids/1)
```

## Errors

A field with errors (and `used_input?/1`) marks the picker
`aria-invalid`; give the id of the error's element as
`aria-describedby`, as for an input:

```heex
<.select field={@form[:status]} options={@statuses} aria-describedby="status-error" />
<p :for={msg <- @form[:status].errors} id="status-error">{translate_error(msg)}</p>
```

## Labels

A `<label for>` of the field names the picker, and a click on it moves
the focus to the picker:

```heex
<label for={@form[:status].id}>Status</label>
<.select field={@form[:status]} options={@statuses} />
```

Or give `label_id` (the id of an element that names it), or `label` (the
name itself). Without any, the picker is named by its field, in words.

## A `required` picker

`required` is a rule (a value must be chosen), the native `<select>`'s
`required`, and no clear button. When the browser stops a submit for an
empty required picker, the picker takes the focus and says so.
