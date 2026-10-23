defmodule ErabiTest.ChoosingLive do
  @moduledoc "A LiveView with a picker that shows who is choosing in it (Erabi.Issho), for its tests."
  use Phoenix.LiveView

  import Erabi.Components

  on_mount(Issho.Live)

  @statuses [
    %{value: "todo", label: "To do"},
    %{value: "doing", label: "Doing"},
    %{value: "done", label: "Done"}
  ]

  def mount(_params, %{"room" => room, "user" => user}, socket) do
    {:ok,
     assign(socket, room: room, user: %{id: user, name: String.capitalize(user)}, status: "todo")}
  end

  def render(assigns) do
    ~H"""
    <.select
      name="status"
      value={@status}
      options={statuses()}
      label="Status"
      issho={[instance: ErabiTest.Issho, document: @room <> "/status"]}
      user={@user}
    />
    """
  end

  def statuses, do: @statuses

  def handle_info({:status, status}, socket), do: {:noreply, assign(socket, status: status)}
end
