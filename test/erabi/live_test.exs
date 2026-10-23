defmodule Erabi.LiveTest do
  use ExUnit.Case, async: true

  import Phoenix.ConnTest
  import Phoenix.LiveViewTest

  @endpoint ErabiTest.Endpoint

  setup do
    {:ok, view, _html} = live_isolated(build_conn(), ErabiTest.FormLive)
    %{view: view}
  end

  defp search(view, id, query, offset \\ 0) do
    ref = System.unique_integer([:positive])

    view
    |> element("##{id}")
    |> render_hook("erabi:search", %{
      "v" => 1,
      "id" => id,
      "ref" => ref,
      "query" => query,
      "offset" => offset
    })

    %{proxy: {proxy_ref, _topic, _pid}} = view
    assert_receive {^proxy_ref, {:reply, %{"ref" => ^ref} = reply}}
    reply
  end

  test "a search answers with options, and pages of 50", %{view: view} do
    reply = search(view, "task_city_picker", "city 1")
    assert %{"v" => 1, "more" => false, "options" => options} = reply
    assert hd(options) == %{"v" => "City 1", "l" => "City 1"}
    assert length(options) == 32

    first = search(view, "task_city_picker", "")
    assert %{"more" => true, "options" => page} = first
    assert length(page) == 50

    assert %{"more" => true, "options" => [%{"l" => "City 51"} | _]} =
             search(view, "task_city_picker", "", 50)

    assert %{"more" => false, "options" => last} = search(view, "task_city_picker", "", 100)
    assert length(last) == 20
  end

  test "a search of two arguments pages itself", %{view: view} do
    assert %{"more" => true, "options" => page} = search(view, "task_paged_picker", "")
    assert length(page) == 50
  end

  test "an async search answers later, with a push", %{view: view} do
    assert %{"pending" => true, "ref" => ref} = search(view, "task_slow_picker", "city 12")
    assert_push_event(view, "erabi:results", %{"ref" => ^ref, "options" => options}, 1000)
    assert Enum.map(options, & &1["l"]) == ["City 12", "City 120"]
  end

  test "a picker with no search says so", %{view: view} do
    assert %{"error" => true} = search(view, "task_labels_picker", "x")
  end

  test "the server sets a picker's value", %{view: view} do
    render_click(view, "set", %{})
    assert_push_event(view, "erabi:set", %{id: "task_labels_picker", value: ["docs"]})
  end
end
