defmodule Erabi.TestTest do
  use ExUnit.Case, async: true

  import Phoenix.ConnTest
  import Phoenix.LiveViewTest
  import Erabi.Test

  @endpoint ErabiTest.Endpoint

  setup do
    {:ok, view, _html} = live_isolated(build_conn(), ErabiTest.FormLive)
    %{view: view}
  end

  test "options and chosen values, as the server rendered them", %{view: view} do
    assert choices(view, "task_labels_picker") == ["Bug", "Docs", "feature"]
    assert chosen(view, "task_labels_picker") == ["Bug"]
    assert chosen(view, "#task_owner_picker") == ["Grace"]
  end

  defp posted(view),
    do: view |> element("#params") |> render() |> LazyHTML.from_fragment() |> LazyHTML.text()

  test "choose sends the form's phx-change, with the other pickers as they are", %{view: view} do
    choose(view, "task_labels_picker", ["docs", :feature])
    assert posted(view) =~ ~s("labels" => ["", "docs", "feature"])
    assert posted(view) =~ ~s("owner" => "2")

    choose(view, "task_owner_picker", 3)
    assert posted(view) =~ ~s("owner" => "3")

    choose(view, "task_owner_picker", nil)
    assert posted(view) =~ ~s("owner" => "")
  end

  test "search runs a picker's search, sync or async", %{view: view} do
    assert search(view, "task_city_picker", "city 11") == [
             "City 11",
             "City 110",
             "City 111",
             "City 112",
             "City 113",
             "City 114",
             "City 115",
             "City 116",
             "City 117",
             "City 118",
             "City 119"
           ]

    assert search(view, "task_slow_picker", "city 12") == ["City 12", "City 120"]
  end

  test "a picker that is not there, said", %{view: view} do
    assert_raise ExUnit.AssertionError, ~r/no picker with the id "nope"/, fn ->
      choices(view, "nope")
    end
  end
end
