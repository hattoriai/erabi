# Search

Options that come from the server as people type: cities, people of a
large organization, records of a table.

## The search

A picker's `search` is a function of the query, run in the LiveView by
`Erabi.Live`:

```elixir
defmodule MyAppWeb.TaskLive do
  use MyAppWeb, :live_view

  on_mount Erabi.Live
  ...
end
```

```heex
<.combobox field={@form[:city_id]} search={&Places.cities/1} selected={@city} />
```

```elixir
def cities(query) do
  Repo.all(from c in City, where: ilike(c.name, ^"%#{query}%"), order_by: c.name, limit: 200)
end
```

The LiveView answers the searches of its pickers itself: your app writes
no event clauses. An empty query is the list as it opens: recent or
suggested options.

The function gives options (anything a picker takes). The picker shows
the first 50, and the next 50 as the list scrolls. A function of two
arguments gets the page too, `%{offset: n, limit: 50}`, and gives
`{options, more?}`, for a search that pages in the database.

## The labels of chosen values

A chosen value whose option is not among the options (the city chosen
last week) shows by its label when you give its option as `selected`:

```elixir
selected = if task.city, do: [%{value: task.city.id, label: task.city.name}], else: []
```

## In the browser

As people type, the picker asks a moment after they stop (140 ms), with
a ref: a late answer to an older query is dropped. The answers of the
last 40 queries are kept, so going back is instant. While an answer
loads, the last one stays on screen; with none, "Searching…". An answer
that does not come in 8 seconds is "Results did not load", with a retry.

## Async

The search runs in the LiveView's process, so a slow one holds it. With
`async`, it runs in a task (`start_async`) and its answer comes when it
is ready:

```heex
<.select field={@form[:repo]} search={&GitHub.repos/1} async />
```

## Ranking

The browser keeps the server's order, and marks the matched letters. To
rank as the picker ranks the options it has, use `Erabi.Match.rank/2`:

```elixir
def cities(query), do: all_cities() |> Erabi.Match.rank(query) |> Enum.map(&elem(&1, 0))
```

## When options change

`Erabi.Live.refresh/2` makes a picker forget its cached answers, when the
options on the server changed (a new record).

## Tests

`Erabi.Test.search/3` runs a picker's search as the picker does, sync or
async, and gives the labels it found.
