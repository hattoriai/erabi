# Accessibility

## Roles

* `select`, `multi_select` and `person_picker`: the field is a
  select-only combobox (`role="combobox"`, `aria-haspopup="listbox"`),
  focusable, with the list's options as its active descendant. With a
  box to filter the list, the popup is a dialog (`aria-haspopup="dialog"`)
  and its box the combobox.
* `combobox` and `tags`: the field's text box is an editable combobox
  (`aria-autocomplete="list"`).
* The list is a `listbox` (`aria-multiselectable` for several values),
  its options `option`s with `aria-selected`, `aria-disabled`, and
  `aria-setsize` and `aria-posinset` (a long list draws only the rows on
  screen). Group headings are presentation.
* The focus stays in the field, or in the list's box: the active option
  is `aria-activedescendant`.

## Keys

| Key | |
| --- | --- |
| ↓ ↑ | open the list; move |
| Alt+↑ | close the list |
| Page Down, Page Up | move by ten |
| Home, End | first, last (in a box, when it is empty) |
| Enter | choose the active option; on a closed select, open it |
| Space | choose, on a select (not in a box) |
| Letters | typeahead on a select; search in a box |
| Backspace, Delete | take the last chip back (in a box, when it is empty); clear a select |
| , | create a tag |
| Escape | close the list (it stops there: a dialog or a grid around it does not close); in a box with text, empty it |
| Tab | close the list and move on |

## Announcements

A polite live region says what changed: "Docs added", "Bug removed", the
number of options found as people type, why an option cannot be chosen
("Choose 3 at most"), why a value cannot be created ("At most 24
characters").

## Names and errors

A `<label for>`, `label_id` or `label` names the field. `aria-invalid`
and `aria-describedby` go to the field from the form's errors.

## Color

The palette's pairs pass WCAG AAA. A colored chip has its label in
words: color is never the only sign. Forced colors draw borders and the
active option in the system's colors; reduced motion stops the popup's
animation and the spinner.

## Tested

`mix test.e2e` checks the roles, names, active descendants and
announcements in Chromium, Firefox and WebKit. Not tested yet: screen
readers themselves, and phones (see [Known limits](limits.md)).
