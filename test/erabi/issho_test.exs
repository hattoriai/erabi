defmodule Erabi.IsshoTest do
  # Who is choosing in a picker, with Issho: people and agents, seen by
  # the others; the value stays the app's.
  use ExUnit.Case, async: false

  import Phoenix.Component, only: [sigil_H: 2]
  import Phoenix.ConnTest
  import Phoenix.LiveViewTest

  alias Issho.Tool.Context

  doctest Erabi.Issho

  @endpoint ErabiTest.Endpoint

  setup do
    %{room: "page:#{System.unique_integer([:positive])}"}
  end

  defp open(room, user) do
    {:ok, view, _html} =
      live_isolated(build_conn(), ErabiTest.ChoosingLive,
        session: %{"room" => room, "user" => user}
      )

    view
  end

  defp settle(view) do
    :sys.get_state(view.pid)
    :sys.get_state(view.pid)
  end

  # The last "erabi:people" that a LiveView pushed to its picker.
  defp people(view) do
    settle(view)
    Process.sleep(30)
    settle(view)
    collect(view, nil)
  end

  defp collect(%{proxy: {ref, _topic, _pid}} = view, last) do
    receive do
      {^ref, {:push_event, "erabi:people", %{id: "status_picker", people: people}}} ->
        collect(view, people)
    after
      50 -> last
    end
  end

  test "the picker is the room's document, and the others see who has it open, on which option",
       %{room: room} do
    ada = open(room, "ada")
    ken = open(room, "ken")

    assert render(ada) =~ ~s(data-issho-doc="#{room}/status")
    assert people(ken) in [nil, []]

    ada
    |> with_target("#status_picker-issho")
    |> render_hook("erabi:place", %{"at" => %{"open" => true, "option" => "done"}})

    assert [%{"name" => "Ada", "kind" => "human", "at" => %{"open" => true, "option" => "done"}}] =
             people(ken)

    ada |> with_target("#status_picker-issho") |> render_hook("erabi:place", %{"at" => nil})
    assert people(ken) == []
  end

  test "a place that is not a picker's is not shared", %{room: room} do
    ada = open(room, "ada")
    ken = open(room, "ken")
    _ = people(ken)

    ada
    |> with_target("#status_picker-issho")
    |> render_hook("erabi:place", %{"at" => %{"cell" => [1, "a"]}})

    assert people(ken) in [nil, []]
  end

  test "an agent goes to the picker and to the option, then the app's change lands", %{room: room} do
    ken = open(room, "ken")
    _ = people(ken)

    ctx = Context.new(ErabiTest.Issho, %{id: "agent:claude", name: "Claude", kind: :agent})
    {:ok, participant} = Context.join(ctx, room)
    test = self()

    result =
      Erabi.Issho.choose(participant, room <> "/status", "done", fn ->
        send(test, {:during, people(ken)})
        send(ken.pid, {:status, "done"})
        :saved
      end)

    assert result == :saved

    assert_received {:during,
                     [
                       %{
                         "name" => "Claude",
                         "kind" => "agent",
                         "at" => %{"open" => true, "option" => "done"}
                       }
                     ]}

    assert people(ken) == []
    assert render(ken) =~ ~s(data-value="[&quot;done&quot;]")
  end

  test "a picker with issho needs its user, said" do
    assigns = %{}

    assert_raise ArgumentError, ~r/needs its `user`/, fn ->
      rendered_to_string(~H"""
      <Erabi.Components.select name="s" value={nil} options={["a"]} label="S" issho={[instance: ErabiTest.Issho, document: "page:1/s"]} />
      """)
    end
  end
end
