defmodule ErabiTest.FormLive do
  @moduledoc "A LiveView with a form of pickers, for the Erabi.Live and Erabi.Test tests."
  use Phoenix.LiveView

  import Erabi.Components

  on_mount(Erabi.Live)

  @labels [
    %{value: "bug", label: "Bug", color: :red},
    %{value: "docs", label: "Docs", color: :brown},
    "feature"
  ]
  @people [%{id: 1, name: "Ada"}, %{id: 2, name: "Grace"}, %{id: 3, name: "Claude", kind: :agent}]

  def labels, do: @labels
  def people, do: @people

  def cities(query),
    do: Enum.filter(cities(), &String.contains?(String.downcase(&1), String.downcase(query)))

  def cities, do: for(n <- 1..120, do: "City #{n}")

  def paged(query, %{offset: offset, limit: limit}) do
    all = cities(query)
    {all |> Enum.drop(offset) |> Enum.take(limit), length(all) > offset + limit}
  end

  def slow(query) do
    Process.sleep(50)
    cities(query)
  end

  def mount(_params, _session, socket) do
    {:ok,
     assign(socket, params: %{}, form: to_form(%{"labels" => ["bug"], "owner" => "2"}, as: :task))}
  end

  def render(assigns) do
    ~H"""
    <.form for={@form} id="task-form" phx-change="validate">
      <.multi_select field={@form[:labels]} options={labels()} max={2} />
      <.person_picker field={@form[:owner]} people={people()} me={1} />
      <.combobox field={@form[:city]} search={&cities/1} />
      <.combobox field={@form[:paged]} search={&paged/2} />
      <.select field={@form[:slow]} search={&slow/1} async />
    </.form>
    <pre id="params">{inspect(@params)}</pre>
    """
  end

  def handle_event("validate", %{"task" => params}, socket),
    do: {:noreply, assign(socket, params: params)}

  def handle_event("set", _params, socket),
    do: {:noreply, Erabi.Live.set(socket, "task_labels_picker", ["docs"])}
end
