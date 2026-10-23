# Grids

A picker can be the editor of a grid's cells: a column of
[Masu](https://hex.pm/packages/masu) whose cells are a status, labels or
a person.

## The column

`Erabi.cell_editor/2` gives the column's `editor`, with its options,
rules and words resolved on the server:

```heex
<.data_grid id="tasks" source={@tasks}>
  <:col field={:status} editor={Erabi.cell_editor(:select, options: @statuses)} />
  <:col field={:labels} editor={Erabi.cell_editor(:multi_select, options: @labels, max: 3)} />
  <:col field={:owner_id} editor={Erabi.cell_editor(:person, options: @members, me: @current_user)} />
</.data_grid>
```

The kinds are `:select`, `:multi_select`, `:combobox`, `:tags`,
`:person` (with `multiple: true` for several people), `:color` and
`:emoji`, and
the options those of the components: `options`, `rules` and its
shortcuts, `filter`, `me`, `placeholder`, `locale` and `messages`; and
for `:color`, `palette`, `custom` and `contrast`:

```heex
<:col field={:color} editor={Erabi.cell_editor(:color, custom: true)} />
```

## The browser

Register the editors once, in your app's JavaScript:

```js
import { configure } from "masu"
import { erabiEditors } from "erabi"
import "erabi/color" // for color columns
import "erabi/emoji" // for emoji columns

configure({ editors: erabiEditors() })
```

Without `erabi/color` or `erabi/emoji`, such a column is a select of its
options.

## How it edits

An emoji is saved as it is chosen, and a letter typed on the cell
searches; closed with none, the edit is cancelled. A color is saved as its popup closes (a swatch, Enter, or a click away),
so that a drag in its area saves once; closed with no change, the edit
is cancelled. A letter that opened the editor goes to its hex box.

The picker draws over the cell, with its list open; a letter that opened
the editor is typed into it. A picker of one value saves it as it is
chosen. A picker of several saves when the editor closes: Tab or a click
away, as the grid's own editors do. Escape closes the picker's list
first, and then lets the edit go.

The grid's rules hold as for its own editors: it checks the value by the
column's type and the changeset, and keeps undo, conflicts and "Ada is
editing".
