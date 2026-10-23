defmodule Erabi.Option do
  @moduledoc """
  An option of a picker: its value, and how it shows.

  A picker takes its options as a `<select>` does, or richer:

      ["Draft", "Published"]                          # values, shown as they are
      [{"To do", :todo}, {"Done", :done}]             # {label, value}
      [todo: "To do", done: "Done"]                   # value: label, as a keyword list
      [%{value: 7, label: "Ada", avatar: "/a.png"}]   # maps
      [{"Fruit", ["Apple", "Pear"]}]                  # a group, as {name, options}

  and an option map (or `Erabi.Option.new/1`) has these keys:

    * `:value` - what the form posts (as text: an atom's name, an
      integer's digits, a struct's `Phoenix.Param`);
    * `:label` - the words shown and searched; the value as text unless
      given;
    * `:hint` - words shown under the label, and searched after it;
    * `:color` - a chip's color: one of `colors/0` (`:blue`), or a CSS
      color (`"#3f6f8f"`);
    * `:icon` - the name of an icon, drawn by the picker's `:icon` slot;
    * `:avatar` - an image URL, for a person;
    * `:kind` - `:human` or `:agent`, for a person;
    * `:group` - the name of the group the option is listed under;
    * `:keywords` - other words that find the option ("crimson" for Red);
    * `:priority` - added to the option's rank when people search;
    * `:disabled` - `true` (or the reason, as text) for an option that
      shows but cannot be chosen.

  For people, `:id` stands for `:value` and `:name` for `:label`, so a
  user struct or an `Issho.Actor`'s display map is an option as it is.
  """

  @enforce_keys [:value, :label]
  defstruct [
    :value,
    :label,
    :hint,
    :color,
    :icon,
    :avatar,
    :kind,
    :group,
    keywords: [],
    priority: 0,
    disabled: false
  ]

  @type color :: atom() | String.t()

  @type t :: %__MODULE__{
          value: term(),
          label: String.t(),
          hint: String.t() | nil,
          color: color() | nil,
          icon: String.t() | nil,
          avatar: String.t() | nil,
          kind: :human | :agent | nil,
          group: String.t() | nil,
          keywords: [String.t()],
          priority: integer(),
          disabled: boolean() | String.t()
        }

  @colors ~w(gray brown orange yellow green blue purple pink red)a
  @keys ~w(value label hint color icon avatar kind group keywords priority disabled id name)a
  @key_names Map.new(@keys, &{Atom.to_string(&1), &1})

  @doc """
  The names of the option colors, each a pair of tones (a chip's
  background and text) for light and dark themes.

      iex> Erabi.Option.colors()
      [:gray, :brown, :orange, :yellow, :green, :blue, :purple, :pink, :red]
  """
  @spec colors() :: [atom()]
  def colors, do: @colors

  @doc """
  An option from a map or a keyword list of its keys (see the moduledoc).
  Raises an `ArgumentError` that says what is wrong.

      iex> Erabi.Option.new(value: :todo, label: "To do", color: :gray)
      %Erabi.Option{value: :todo, label: "To do", color: :gray}
  """
  @spec new(map() | keyword()) :: t()
  def new(fields) when is_list(fields), do: fields |> Map.new() |> new()

  def new(%{__struct__: __MODULE__} = option), do: check!(option)

  def new(%{} = fields) do
    fields = atomize(fields)

    value =
      case fields do
        %{value: value} ->
          value

        %{id: id} ->
          id

        _no_value ->
          raise ArgumentError, "Erabi: an option needs a :value, got: #{inspect(fields)}"
      end

    label = fields[:label] || fields[:name] || param(value)

    check!(%__MODULE__{
      value: value,
      label: to_string(label),
      hint: text(fields[:hint]),
      color: fields[:color],
      icon: text(fields[:icon]),
      avatar: text(fields[:avatar]),
      kind: kind(fields[:kind]),
      group: text(fields[:group]),
      keywords: fields |> Map.get(:keywords, []) |> List.wrap() |> Enum.map(&to_string/1),
      priority: fields[:priority] || 0,
      disabled: fields[:disabled] || false
    })
  end

  # A struct of the app's (a user): its fields, so that :id and :name are
  # the value and the label.
  defp atomize(%{__struct__: _} = struct), do: struct |> Map.from_struct() |> atomize()

  defp atomize(fields) do
    Enum.reduce(fields, %{}, fn
      {key, value}, acc when is_atom(key) ->
        Map.put(acc, key, value)

      {key, value}, acc when is_binary(key) ->
        case Map.fetch(@key_names, key) do
          {:ok, atom} -> Map.put(acc, atom, value)
          :error -> acc
        end

      _other, acc ->
        acc
    end)
  end

  defp text(nil), do: nil
  defp text(value), do: to_string(value)

  defp kind(nil), do: nil
  defp kind(kind) when kind in [:human, :agent], do: kind
  defp kind(kind) when kind in ["human", "agent"], do: String.to_existing_atom(kind)
  defp kind(:service), do: :agent

  defp kind(kind),
    do:
      raise(ArgumentError, "Erabi: an option's :kind is :human or :agent, got: #{inspect(kind)}")

  defp check!(%__MODULE__{} = option) do
    cond do
      not color?(option.color) ->
        raise ArgumentError,
              "Erabi: an option's :color is one of #{inspect(@colors)} or a CSS color, got: #{inspect(option.color)}"

      not is_integer(option.priority) ->
        raise ArgumentError,
              "Erabi: an option's :priority is an integer, got: #{inspect(option.priority)}"

      not (is_boolean(option.disabled) or is_binary(option.disabled)) ->
        raise ArgumentError,
              "Erabi: an option's :disabled is a boolean or a reason, got: #{inspect(option.disabled)}"

      true ->
        option
    end
  end

  defp color?(nil), do: true
  defp color?(color) when color in @colors, do: true

  defp color?(color) when is_binary(color),
    do: color in Enum.map(@colors, &Atom.to_string/1) or css_color?(color)

  defp color?(_color), do: false

  # A plain CSS color: a hex, or a color function of numbers and percents,
  # or a named color. Nothing that could close the style it goes in.
  defp css_color?(color) do
    Regex.match?(
      ~r/\A(#[0-9a-fA-F]{3,8}|[a-zA-Z]+|(rgb|rgba|hsl|hsla|oklch|oklab|lab|lch)\([0-9a-zA-Z.,%\s\/+-]*\))\z/,
      color
    )
  end

  @doc """
  The options of anything a picker takes (see the moduledoc), in order.
  Raises an `ArgumentError` for an option that is not one, or for two
  options with the same value.

      iex> Erabi.Option.list([{"To do", :todo}, done: "Done"]) |> Enum.map(& &1.label)
      ["To do", "Done"]
  """
  @spec list(term()) :: [t()]
  def list(nil), do: []

  def list(options) when is_list(options) do
    options = Enum.flat_map(options, &expand(&1, nil))

    options
    |> Enum.group_by(&param(&1.value))
    |> Enum.find(fn {_param, same} -> length(same) > 1 end)
    |> case do
      nil -> options
      {param, _same} -> raise ArgumentError, "Erabi: two options have the value #{inspect(param)}"
    end
  end

  def list(other),
    do: raise(ArgumentError, "Erabi: the options are a list, got: #{inspect(other)}")

  # One entry of a list of options: an option, or a group of them.
  defp expand({group, options}, nil)
       when is_list(options) and options != [] and not is_atom(group),
       do: Enum.flat_map(options, &expand(&1, to_string(group)))

  defp expand({label, value}, group) when is_binary(label),
    do: [with_group(new(value: value, label: label), group)]

  defp expand({value, label}, group) when is_atom(value) and is_binary(label),
    do: [with_group(new(value: value, label: label), group)]

  defp expand(%__MODULE__{} = option, group), do: [with_group(check!(option), group)]
  defp expand(%{} = map, group), do: [with_group(new(map), group)]

  defp expand(value, group) when is_binary(value) or is_atom(value) or is_number(value),
    do: [with_group(new(value: value), group)]

  defp expand(other, _group), do: raise(ArgumentError, "Erabi: not an option: #{inspect(other)}")

  defp with_group(option, nil), do: option
  defp with_group(%{group: nil} = option, group), do: %{option | group: group}
  defp with_group(option, _group), do: option

  @doc """
  A value as a form posts it: text.

      iex> Erabi.Option.param(:todo)
      "todo"
      iex> Erabi.Option.param(42)
      "42"
      iex> Erabi.Option.param(nil)
      ""
  """
  @spec param(term()) :: String.t()
  def param(nil), do: ""
  def param(value) when is_binary(value), do: value
  def param(value) when is_atom(value), do: Atom.to_string(value)
  def param(value) when is_integer(value), do: Integer.to_string(value)
  def param(value) when is_float(value), do: to_string(value)
  def param(%{__struct__: _} = value), do: Phoenix.Param.to_param(value)
  def param(%{id: id}), do: param(id)
  def param(%{"id" => id}), do: param(id)

  def param(value),
    do:
      raise(
        ArgumentError,
        "Erabi: a value is text, an atom, a number or a struct, got: #{inspect(value)}"
      )

  @doc """
  The values of a field as a form posts them: a list of texts, without
  blanks. A single value is a list of one.

      iex> Erabi.Option.params([:a, "b", nil, ""])
      ["a", "b"]
      iex> Erabi.Option.params(7)
      ["7"]
  """
  @spec params(term()) :: [String.t()]
  def params(values) when is_list(values),
    do: values |> Enum.map(&param/1) |> Enum.reject(&(&1 == ""))

  def params(value), do: params([value])

  @doc false
  # The option as the browser gets it: short keys, only those it has.
  @spec to_wire(t()) :: map()
  def to_wire(%__MODULE__{} = option) do
    %{"v" => param(option.value), "l" => option.label}
    |> put("h", option.hint)
    |> put("c", option.color && to_string(option.color))
    |> put("i", option.icon)
    |> put("a", option.avatar)
    |> put("p", option.kind && Atom.to_string(option.kind))
    |> put("g", option.group)
    |> put("k", if(option.keywords == [], do: nil, else: option.keywords))
    |> put("r", if(option.priority == 0, do: nil, else: option.priority))
    |> put("d", if(option.disabled == false, do: nil, else: option.disabled))
  end

  defp put(map, _key, nil), do: map
  defp put(map, key, value), do: Map.put(map, key, value)
end
