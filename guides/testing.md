# Testing

`Erabi.Test` chooses and searches in `Phoenix.LiveViewTest`, with no
browser.

```elixir
import Erabi.Test

test "labels a task", %{conn: conn} do
  {:ok, view, _html} = live(conn, ~p"/tasks/1")

  assert choices(view, "task_labels_picker") == ["Bug", "Feature", "Docs"]
  assert chosen(view, "task_labels_picker") == ["Bug"]

  html = choose(view, "task_labels_picker", ["bug", "docs"])
  assert html =~ "2 labels"
end
```

* `choose/3` sends the form's `phx-change` with the values in the
  picker's input, as the picker does in a browser, and with the other
  pickers of the form as they are. The form needs an `id`. The values are
  not checked here: a test can choose a value that the rules refuse, to
  see the error.
* `choices/2` gives the labels of a picker's options, in order (not
  `options/2`: `Phoenix.ConnTest` has one).
* `chosen/2` gives the labels of its chosen values, as the server
  rendered them.
* `search/3` runs a picker's search, sync or async, and gives the labels
  it found.

The inputs of a picker are not updated in LiveViewTest's copy of the
page (they are under `phx-update="ignore"`, as in a browser, where the
hook keeps them). To submit, give the form the values:

```elixir
view
|> form("#task-form", task: %{labels: ["bug"]})
|> render_submit()
```

## In a browser

Erabi's own browser tests (`mix test.e2e`) run in Chromium, Firefox and
WebKit against the development pages (`mix dev`).
