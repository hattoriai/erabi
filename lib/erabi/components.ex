defmodule Erabi.Components do
  @moduledoc """
  The pickers: `select/1`, `multi_select/1`, `combobox/1`, `tags/1` and
  `person_picker/1`.

      import Erabi.Components

      <.select field={@form[:status]} options={@statuses} />
      <.multi_select field={@form[:labels]} options={@labels} max={3} />
      <.combobox field={@form[:city_id]} search={&Places.cities/1} selected={@city} />
      <.tags field={@form[:tags]} options={@tags} create />
      <.person_picker field={@form[:owner_id]} people={@members} me={@current_user} />

  Each picker is a field of a form: it posts what the browser's own
  `<select>` would (`name`, or `name[]` for several values), works with
  `phx-change` and changesets, and is that `<select>` until its hook
  mounts (and with JavaScript off).

  A picker needs the `Erabi` hook in the LiveSocket and the Erabi CSS
  (see the README). A picker with `search` needs `on_mount Erabi.Live` in
  its LiveView.
  """

  use Phoenix.Component

  import Erabi.Components.Shared

  alias Erabi.{Messages, Option, Rules}

  @kinds [:select, :multi_select, :combobox, :tags, :person]

  # Lists of more options than this have a box to filter them, unless
  # `filter` says otherwise.
  @filter_from 10

  @doc """
  A picker of one value from a list, as a `<select>`: a box that opens
  the list, with typeahead, and a box to filter a long list.
  """
  shared_attrs()
  def select(assigns), do: assigns |> prepare(:select, false) |> picker()

  @doc """
  A picker of several values, shown as chips: the list stays open as
  people check and uncheck. `min` and `max` count the values.
  """
  shared_attrs()
  def multi_select(assigns), do: assigns |> prepare(:multi_select, true) |> picker()

  @doc """
  A box to type in that suggests options as people type, and takes one.
  With `create`, a typed value that is not an option is kept as it is.
  """
  shared_attrs()
  def combobox(assigns), do: assigns |> prepare(:combobox, false) |> picker()

  @doc """
  Chips that people type: suggestions as they type, Enter or a comma to
  add one, Backspace to take the last one back. With `create`, a new tag
  is "Create “…”" at the end of the list, under the rules' `pattern` and
  lengths.
  """
  shared_attrs()
  def tags(assigns), do: assigns |> prepare(:tags, true) |> picker()

  @doc """
  A picker of people and agents: avatars (an image, or initials on the
  person's color), agents marked as such, and `me` first. The people are
  maps or structs with `:id` and `:name` (and `:avatar`, `:color`,
  `:kind`), as users and `Issho.Actor`s are; give them as `people` (or
  `options`), or find them with `search`.
  """
  shared_attrs()
  attr :people, :list, default: nil, doc: "the people and agents to choose from"

  attr :me, :any,
    default: nil,
    doc: "the person who is choosing (a person, or their id): listed first, marked"

  attr :multiple, :boolean, default: false, doc: "whether several people may be chosen"

  def person_picker(assigns) do
    assigns = if assigns.people, do: assign(assigns, :options, assigns.people), else: assigns
    assigns |> prepare(:person, assigns.multiple) |> picker()
  end

  defp picker(assigns) do
    ~H"""
    <div
      id={@id}
      class={["erabi", "erabi-#{@kind}", @class]}
      phx-hook="Erabi"
      phx-update="ignore"
      data-config={@config}
      data-value={@value_json}
      data-issho-doc={@issho_join && @issho_join.document}
      {@rest}
    >
      <input :if={@multiple} type="hidden" name={@name} value="" />
      <select
        id={@input_id}
        name={@name}
        multiple={@multiple}
        class="erabi-native"
        data-part="value"
        required={@required}
        disabled={@disabled}
        aria-labelledby={@label_id}
        aria-label={!@label_id && @label}
        aria-describedby={@described_by}
        aria-invalid={@invalid && "true"}
      >
        <option :if={!@multiple} value="">{@empty}</option>
        <%= for {group, options} <- @groups do %>
          <optgroup :if={group} label={group}>
            <option :for={option <- options} value={option.param} selected={option.selected} disabled={option.disabled}>
              {option.label}
            </option>
          </optgroup>
          <option :for={option <- options} :if={!group} value={option.param} selected={option.selected} disabled={option.disabled}>
            {option.label}
          </option>
        <% end %>
      </select>
      <template :for={name <- @icons} data-erabi-icon={name}>{render_slot(@icon, name)}</template>
    </div>
    <.live_component
      :if={@issho_join}
      module={Erabi.Issho.Presence}
      id={"#{@id}-issho"}
      picker={@id}
      join={@issho_join}
      user={@user}
    />
    """
  end

  defp prepare(assigns, kind, multiple) when kind in @kinds do
    rules = rules(assigns)
    options = Option.list(assigns.options)
    selected = selected(assigns.selected, options)
    values = values(assigns, multiple)
    %{id: id, input_id: input_id, name: name} = names(assigns, multiple)
    locale = assigns.locale || Application.get_env(:erabi, :locale, "en")
    messages = Messages.for_locale(locale, assigns.messages || %{})
    label = label(assigns)
    {described_by, invalid, rest} = aria(assigns)

    register_search(assigns.search, id, assigns.async)
    issho_join = issho_join(assigns.issho, assigns.user)

    config = %{
      "v" => 1,
      "id" => id,
      "kind" => Atom.to_string(kind),
      "multiple" => multiple,
      "options" => Enum.map(options, &Option.to_wire/1),
      "selected" => Enum.map(selected, &Option.to_wire/1),
      "rules" => Rules.to_client(rules),
      "messages" => messages,
      "locale" => locale,
      "labelId" => assigns.label_id,
      "label" => label,
      "describedBy" => described_by,
      "invalid" => invalid,
      "placeholder" => assigns.placeholder,
      "search" => assigns.search != nil,
      "filter" => filter?(assigns.filter, options),
      "clearable" => clearable?(assigns.clearable, rules, multiple),
      "disabled" => assigns.disabled,
      "readonly" => assigns.readonly,
      "me" => assigns[:me] && Option.param(assigns[:me]),
      "onChange" => assigns.on_change,
      "icons" => assigns.icon != [],
      "issho" => issho_join && %{"target" => "##{id}-issho"}
    }

    assign(assigns,
      kind: kind,
      multiple: multiple,
      id: id,
      input_id: input_id,
      name: name,
      label: label,
      required: rules.required,
      invalid: invalid,
      described_by: described_by,
      rest: rest,
      config: JSON.encode!(reject_nils(config)),
      value_json: JSON.encode!(values),
      empty: assigns.placeholder || messages["choose"],
      groups: native_groups(options ++ selected, values),
      icons: icons(assigns.icon, options),
      issho_join: issho_join
    )
  end

  # The room of a picker with `issho` (Erabi.Issho): its options checked as
  # every component of the family checks them.
  defp issho_join(nil, _user), do: nil

  defp issho_join(issho, user) do
    unless Code.ensure_loaded?(Erabi.Issho.Presence) do
      raise ArgumentError,
            "Erabi: a picker's `issho` needs Issho in your deps: {:issho, \"~> 0.3\"}"
    end

    if user == nil,
      do:
        raise(ArgumentError, "Erabi: a picker with `issho` needs its `user`, the person choosing")

    Issho.Join.new!(issho)
  end

  # The options of chosen values that are not among the options.
  defp selected(selected, options) do
    known = MapSet.new(options, &Option.param(&1.value))
    selected |> Option.list() |> Enum.reject(&MapSet.member?(known, Option.param(&1.value)))
  end

  # The values as the picker posts them: texts, one at most unless multiple.
  defp values(assigns, multiple) do
    raw = if assigns.field, do: assigns.field.value, else: assigns.value
    values = raw |> value_list(multiple) |> Option.params()
    if multiple, do: values, else: Enum.take(values, 1)
  end

  defp names(%{field: field} = assigns, multiple) do
    base =
      assigns.name || (field && field.name) ||
        raise ArgumentError, "Erabi: a picker needs a `field` or a `name`"

    input_id = (field && field.id) || assigns.id || base

    %{
      id: assigns.id || input_id <> "_picker",
      input_id: input_id,
      name: if(multiple, do: base <> "[]", else: base)
    }
  end

  defp label(%{label: nil, label_id: nil, field: %{field: field}}),
    do: Phoenix.Naming.humanize(field)

  defp label(assigns), do: assigns.label

  # aria-describedby and aria-invalid go to the field, not the element.
  defp aria(%{field: field, rest: rest}) do
    {described_by, rest} = Map.pop(rest, :"aria-describedby")
    {aria_invalid, rest} = Map.pop(rest, :"aria-invalid")

    invalid =
      aria_invalid in [true, "true"] or
        (field != nil and field.errors != [] and Phoenix.Component.used_input?(field))

    {described_by, invalid, rest}
  end

  # The options of the native select, by group; a chosen value that is no
  # option is one too, so that it posts.
  defp native_groups(options, values) do
    chosen = MapSet.new(values)
    params = MapSet.new(options, &Option.param(&1.value))
    extra = values |> Enum.reject(&MapSet.member?(params, &1)) |> Enum.map(&Option.new(value: &1))

    (options ++ extra)
    |> Enum.map(fn option ->
      param = Option.param(option.value)

      %{
        param: param,
        label: option.label,
        group: option.group,
        selected: MapSet.member?(chosen, param),
        disabled: option.disabled != false
      }
    end)
    |> Enum.chunk_by(& &1.group)
    |> Enum.map(&{hd(&1).group, &1})
  end

  defp icons([], _options), do: []

  defp icons(_slot, options),
    do: options |> Enum.map(& &1.icon) |> Enum.reject(&is_nil/1) |> Enum.uniq()

  defp rules(assigns) do
    shortcuts =
      [
        required: assigns.required || nil,
        min: assigns.min,
        max: assigns.max,
        create: assigns.create
      ]
      |> Enum.reject(fn {_key, value} -> is_nil(value) end)

    base = Rules.new(assigns.rules)

    if shortcuts == [],
      do: base,
      else: struct!(base, shortcuts) |> Map.from_struct() |> Map.to_list() |> Rules.new()
  end

  defp value_list(nil, _multiple), do: []
  defp value_list(values, true) when is_list(values), do: values
  defp value_list(value, _multiple) when is_list(value), do: value
  defp value_list(value, _multiple), do: [value]

  defp filter?(nil, options), do: length(options) >= @filter_from
  defp filter?(filter, _options), do: filter

  defp clearable?(nil, rules, multiple), do: not multiple and not rules.required
  defp clearable?(clearable, _rules, _multiple), do: clearable

  defp reject_nils(map),
    do: map |> Enum.reject(fn {_key, value} -> is_nil(value) or value == false end) |> Map.new()

  defp register_search(nil, _id, _async), do: :ok

  defp register_search(fun, id, async) when is_function(fun, 1) or is_function(fun, 2),
    do: Erabi.Live.register(id, fun, async: async)

  defp register_search(other, _id, _async),
    do:
      raise(
        ArgumentError,
        "Erabi: `search` is a function of the query (or of the query and the page), got: #{inspect(other)}"
      )
end
