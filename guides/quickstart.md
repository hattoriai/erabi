# Quickstart

A status for tasks, from a list of colored options, checked on the
server as in the browser.

## 1. Install

Add `{:erabi, "~> 0.1"}` to your deps, then:

```sh
mix deps.get
mix erabi.install
```

The installer adds the `Erabi` hook to `assets/js/app.js` and the style
sheet to `assets/css/app.css` (see the README for the manual steps).

## 2. The options

```elixir
defmodule MyApp.Tasks do
  def statuses do
    [
      %{value: :todo, label: "To do", color: :gray},
      %{value: :doing, label: "In progress", color: :yellow},
      %{value: :done, label: "Done", color: :green}
    ]
  end
end
```

## 3. The changeset

The schema's field is an `Ecto.Enum`, as it would be for a `<select>`;
`Erabi.Changeset.validate_choice/4` checks the picker's rules on the
server:

```elixir
schema "tasks" do
  field :status, Ecto.Enum, values: [:todo, :doing, :done]
end

def changeset(task, params) do
  task
  |> cast(params, [:status])
  |> Erabi.Changeset.validate_choice(:status, [required: true], options: MyApp.Tasks.statuses())
end
```

## 4. The picker

Import the components in the `html_helpers` of your web module:

```elixir
import Erabi.Components
```

and put the picker in the form:

```heex
<.form for={@form} id="task-form" phx-change="validate" phx-submit="save">
  <label for={@form[:status].id}>Status</label>
  <.select field={@form[:status]} options={MyApp.Tasks.statuses()} required />
  <button>Save</button>
</.form>
```

The picker posts `task[status]` as a `<select>` would: `phx-change` and
`phx-submit` get it as they are. Before the hook mounts, and with
JavaScript off, it *is* that `<select>`.

## 5. A test

```elixir
import Erabi.Test

test "a task is done", %{conn: conn} do
  {:ok, view, _html} = live(conn, ~p"/tasks/1")
  assert choices(view, "task_status_picker") == ["To do", "In progress", "Done"]
  html = choose(view, "task_status_picker", :done)
  assert html =~ "Done"
end
```

Next: the [Pickers](pickers.md) and [Options](options.md) guides.
