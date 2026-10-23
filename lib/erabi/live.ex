defmodule Erabi.Live do
  @moduledoc """
  The server side of the pickers in a LiveView: the searches of the
  pickers with `search`, and the events that change a picker from the
  server.

      defmodule MyAppWeb.TaskLive do
        use MyAppWeb, :live_view

        on_mount Erabi.Live
        ...
      end

  (or `on_mount Erabi.Live` in a `live_session`). The LiveView then
  answers the searches of its pickers itself: the app writes no event
  clauses.

  ## Search

  A picker's `search` is a function of the query:

      <.combobox field={@form[:city_id]} search={&Places.cities/1} selected={@city} />

      def cities(query), do: Repo.all(from c in City, where: ilike(c.name, ^"%\#{query}%"), limit: 50)

  It gives options (anything a picker takes, see `Erabi.Option`) for the
  query, in the order to show them; an empty query is "as the list
  opens" (recent or suggested options). The picker shows the first 50,
  and the next 50 as the list scrolls.

  A function of two arguments gets the page too, `%{offset: n, limit:
  50}`, and gives `{options, more?}`: for a search that pages in the
  database.

  The search runs in the LiveView's process, so a slow one holds it: with
  `async`, it runs in a task (`start_async`) and its answer comes when it
  is ready. A query that changed meanwhile drops the older answer.

  To rank options as the picker does in the browser, use
  `Erabi.Match.rank/2`.
  """

  import Phoenix.LiveView

  alias Erabi.Option
  alias Phoenix.LiveView.Socket

  @limit 50
  @max_query 200

  @doc false
  def on_mount(:default, _params, _session, socket) do
    {:cont,
     socket
     |> attach_hook(:erabi_events, :handle_event, &handle_event/3)
     |> attach_hook(:erabi_async, :handle_async, &handle_async/3)}
  end

  @doc false
  # Called by the components as they render (in the LiveView's process):
  # the search of a picker, by its id.
  @spec register(String.t(), function(), keyword()) :: :ok
  def register(id, fun, opts) do
    Process.put({__MODULE__, :search, id}, {fun, Keyword.get(opts, :async, false)})
    :ok
  end

  defp handle_event("erabi:search", %{"id" => id} = params, socket) when is_binary(id) do
    {:halt, search(params, socket), socket |> maybe_async(params)}
  end

  defp handle_event(_event, _params, socket), do: {:cont, socket}

  # The reply of a search: its options, or `pending` when it runs in a task.
  defp search(%{"id" => id} = params, _socket) do
    ref = params["ref"]

    case Process.get({__MODULE__, :search, id}) do
      nil ->
        %{"v" => 1, "id" => id, "ref" => ref, "error" => true}

      {_fun, true} ->
        %{"v" => 1, "id" => id, "ref" => ref, "pending" => true}

      {fun, false} ->
        reply(id, ref, run(fun, query(params), offset(params)))
    end
  end

  defp maybe_async(socket, %{"id" => id} = params) do
    case Process.get({__MODULE__, :search, id}) do
      {fun, true} ->
        ref = params["ref"]
        query = query(params)
        offset = offset(params)
        start_async(socket, {:erabi, id, ref}, fn -> run(fun, query, offset) end)

      _other ->
        socket
    end
  end

  defp handle_async({:erabi, id, ref}, result, socket) do
    payload =
      case result do
        {:ok, found} -> reply(id, ref, found)
        {:exit, _reason} -> %{"v" => 1, "id" => id, "ref" => ref, "error" => true}
      end

    {:halt, push_event(socket, "erabi:results", payload)}
  end

  defp handle_async(_name, _result, socket), do: {:cont, socket}

  defp query(params) do
    case params["query"] do
      query when is_binary(query) -> query |> String.trim() |> String.slice(0, @max_query)
      _other -> ""
    end
  end

  defp offset(params) do
    case params["offset"] do
      offset when is_integer(offset) and offset >= 0 -> offset
      _other -> 0
    end
  end

  @doc false
  # Runs a search: its options for the page, and whether there are more.
  @spec run(function(), String.t(), non_neg_integer()) :: {:ok, [Option.t()], boolean()}
  def run(fun, query, offset) do
    {options, more} =
      if is_function(fun, 2) do
        case fun.(query, %{offset: offset, limit: @limit}) do
          {options, more} when is_list(options) -> {Option.list(options), more == true}
          options when is_list(options) -> {Option.list(options), length(options) >= @limit}
        end
      else
        all = query |> fun.() |> Option.list()
        page = all |> Enum.drop(offset) |> Enum.take(@limit)
        {page, length(all) > offset + @limit}
      end

    {:ok, options, more}
  end

  defp reply(id, ref, {:ok, options, more}),
    do: %{
      "v" => 1,
      "id" => id,
      "ref" => ref,
      "options" => Enum.map(options, &Option.to_wire/1),
      "more" => more
    }

  @doc """
  Sets the value of a picker from the server (as text, as the picker
  posts it), without a `phx-change`: for a value the server changed while
  the picker is on the page.
  """
  @spec set(Socket.t(), String.t(), term()) :: Socket.t()
  def set(%Socket{} = socket, id, value),
    do: push_event(socket, "erabi:set", %{id: id, value: Option.params(value)})

  @doc "Forgets the cached answers of a picker's search: its options on the server changed."
  @spec refresh(Socket.t(), String.t()) :: Socket.t()
  def refresh(%Socket{} = socket, id), do: push_event(socket, "erabi:refresh", %{id: id})

  @doc "Opens a picker's list."
  @spec open(Socket.t(), String.t()) :: Socket.t()
  def open(%Socket{} = socket, id), do: push_event(socket, "erabi:open", %{id: id})

  @doc "Closes a picker's list."
  @spec close(Socket.t(), String.t()) :: Socket.t()
  def close(%Socket{} = socket, id), do: push_event(socket, "erabi:close", %{id: id})

  @doc "Moves the focus to a picker."
  @spec focus(Socket.t(), String.t()) :: Socket.t()
  def focus(%Socket{} = socket, id), do: push_event(socket, "erabi:focus", %{id: id})
end
