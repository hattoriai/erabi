defmodule Erabi.Test do
  @moduledoc """
  Helpers for `Phoenix.LiveViewTest`, to choose and search in tests with
  no browser.

      import Erabi.Test

      test "labels a task", %{conn: conn} do
        {:ok, view, _html} = live(conn, ~p"/tasks/1")

        assert options(view, "task_labels_picker") == ["Bug", "Feature", "Docs"]
        html = choose(view, "task_labels_picker", ["bug", "docs"])
        assert html =~ "2 labels"
      end

  `choose/3` sends the form's `phx-change` with the values in the
  picker's input, as the picker does in a browser, and with the other
  pickers of the form as they are. The form must have an `id`. The values
  are checked by the LiveView, not here: a test can choose a value that
  the rules refuse, to see the error.

  The inputs of a picker are not updated in LiveViewTest's copy of the
  page (they are under `phx-update="ignore"`, as in a browser, where the
  hook keeps them). To submit, give the form the values:

      view
      |> form("#task-form", task: %{labels: ["bug"]})
      |> render_submit()

  `search/3` runs a picker's search (`Erabi.Live`) as the picker does,
  and returns the labels it finds.
  """

  @compile {:no_warn_undefined, [LazyHTML]}

  import ExUnit.Assertions

  alias Erabi.Option
  alias Phoenix.LiveViewTest
  alias Plug.Conn.Query

  @doc """
  Chooses values in the picker with the id `picker_id` (a value, a list
  of them for a picker of several, or `nil` to clear it), and returns the
  rendered LiveView (as `Phoenix.LiveViewTest.render_change/2` does). A
  value is what the picker posts: an option's value, as text or as it is
  (an atom, an integer).
  """
  @spec choose(struct(), String.t(), term()) :: String.t()
  def choose(view, picker_id, value) when is_binary(picker_id) do
    picker_id = String.trim_leading(picker_id, "#")
    html = view |> LiveViewTest.render() |> LazyHTML.from_fragment()
    picker = picker!(html, picker_id, "choose/3")
    form_id = form_id(html, picker_id)

    # The form posts every picker in it, as a browser does: the others with
    # the values the server gave them, this one with the new values.
    others =
      html
      |> LazyHTML.query("##{form_id} [phx-hook=Erabi]")
      |> Enum.reject(&(LazyHTML.attribute(&1, "id") == [picker_id]))
      |> Enum.flat_map(fn other ->
        [json] = LazyHTML.attribute(other, "data-value")
        pairs(other, JSON.decode!(json))
      end)

    params =
      (others ++ pairs(picker, Option.params(value || [])))
      |> URI.encode_query()
      |> Query.decode()

    view
    |> LiveViewTest.form("##{form_id}")
    |> LiveViewTest.render_change(Map.put(params, "_target", target(name(picker))))
  end

  @doc """
  The labels of a picker's options, in order, as its list shows them
  before people type.
  """
  @spec options(struct(), String.t()) :: [String.t()]
  def options(view, picker_id) do
    picker_id = String.trim_leading(picker_id, "#")
    html = view |> LiveViewTest.render() |> LazyHTML.from_fragment()
    [json] = html |> picker!(picker_id, "options/2") |> LazyHTML.attribute("data-config")
    json |> JSON.decode!() |> Map.get("options", []) |> Enum.map(& &1["l"])
  end

  @doc """
  The labels of the values chosen in a picker, as the server rendered it.
  """
  @spec chosen(struct(), String.t()) :: [String.t()]
  def chosen(view, picker_id) do
    picker_id = String.trim_leading(picker_id, "#")
    html = view |> LiveViewTest.render() |> LazyHTML.from_fragment()
    picker = picker!(html, picker_id, "chosen/2")
    [json] = LazyHTML.attribute(picker, "data-config")
    [value] = LazyHTML.attribute(picker, "data-value")
    config = JSON.decode!(json)
    labels = Map.new(config["options"] ++ Map.get(config, "selected", []), &{&1["v"], &1["l"]})
    value |> JSON.decode!() |> Enum.map(&Map.get(labels, &1, &1))
  end

  @doc """
  Runs the search of the picker `picker_id` for a query, as the picker
  does as people type, and returns the labels it finds (the first page).
  """
  @spec search(struct(), String.t(), String.t()) :: [String.t()]
  def search(view, picker_id, query) when is_binary(query) do
    picker_id = String.trim_leading(picker_id, "#")
    ref = System.unique_integer([:positive])

    view
    |> LiveViewTest.element("##{picker_id}")
    |> LiveViewTest.render_hook("erabi:search", %{
      "v" => 1,
      "id" => picker_id,
      "ref" => ref,
      "query" => query,
      "offset" => 0
    })

    %{proxy: {proxy_ref, _topic, _pid}} = view
    assert_receive {^proxy_ref, {:reply, %{"ref" => ^ref} = reply}}

    reply =
      if reply["pending"] do
        assert_receive {^proxy_ref, {:push_event, "erabi:results", %{"ref" => ^ref} = pushed}},
                       5000

        pushed
      else
        reply
      end

    if reply["error"],
      do: flunk("Erabi.Test.search/3: the search of #{inspect(picker_id)} failed")

    Enum.map(reply["options"], & &1["l"])
  end

  defp picker!(html, picker_id, fun) do
    picker = LazyHTML.query_by_id(html, picker_id)

    if Enum.empty?(picker),
      do: flunk("Erabi.Test.#{fun}: no picker with the id #{inspect(picker_id)}")

    picker
  end

  defp form_id(html, picker_id) do
    html
    |> LazyHTML.query("form")
    |> Enum.find(fn form -> not Enum.empty?(LazyHTML.query_by_id(form, picker_id)) end)
    |> case do
      nil ->
        flunk("Erabi.Test.choose/3: the picker #{inspect(picker_id)} is not in a form")

      form ->
        case LazyHTML.attribute(form, "id") do
          [id | _] when id != "" -> id
          _none -> flunk("Erabi.Test.choose/3: the form of #{inspect(picker_id)} needs an id")
        end
    end
  end

  defp name(picker) do
    [name] = picker |> LazyHTML.query("select[data-part=value]") |> LazyHTML.attribute("name")
    name
  end

  # The pairs a picker posts: `name` and its value, or `name[]` for each
  # value, after the empty one that a picker of several always posts.
  defp pairs(picker, values) do
    name = name(picker)

    if String.ends_with?(name, "[]"),
      do: [{name, ""} | Enum.map(values, &{name, &1})],
      else: [{name, List.first(values) || ""}]
  end

  defp target(name), do: name |> String.replace("[]", "") |> String.split(["[", "]"], trim: true)
end
