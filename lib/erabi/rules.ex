defmodule Erabi.Rules do
  @moduledoc """
  What a picker accepts: the same rules in the browser, as people choose,
  and on the server, in `Erabi.Changeset`.

      @rules Erabi.Rules.new(max: 3, create: true, max_length: 24)

      <.tags field={@form[:labels]} options={@labels} rules={@rules} />

      changeset
      |> cast(params, [:labels])
      |> Erabi.Changeset.validate_choice(:labels, @rules, options: @labels)

  The rules:

    * `:required` - at least one value;
    * `:min`, `:max` - how many values, for a picker of several;
    * `:create` - whether a value that is not an option may be chosen
      (typed, as a new tag, or kept as text in a combobox); without it,
      every value must be an option;
    * `:min_length`, `:max_length` - the length of a new value, in
      characters (graphemes);
    * `:pattern` - a regular expression a new value must match, whole.
      It runs in the browser too (`RegExp` with the `u` flag), so keep to
      what both have: classes, ranges, `\\d`, `\\w`, `\\s`, `\\p{L}`,
      counts and alternatives.

  A picker of several never posts the same value twice.

  The browser checks the rules as people choose: it does not add a value
  past `:max`, and says why it cannot create a value. The server checks
  them again: the browser is a convenience, and a form can be posted by
  anything.
  """

  defstruct required: false,
            min: nil,
            max: nil,
            create: false,
            min_length: nil,
            max_length: nil,
            pattern: nil

  @type t :: %__MODULE__{
          required: boolean(),
          min: non_neg_integer() | nil,
          max: pos_integer() | nil,
          create: boolean(),
          min_length: non_neg_integer() | nil,
          max_length: pos_integer() | nil,
          pattern: String.t() | nil
        }

  @typedoc """
  Why values are refused, with what the message needs:

    * `{:required, []}`
    * `{:too_few, min: n}`, `{:too_many, max: n}`
    * `{:not_allowed, value: v}` - not an option, and `:create` is off
    * `{:too_short, min_length: n, value: v}`, `{:too_long, max_length: n, value: v}`
    * `{:format, value: v}` - a new value that does not match `:pattern`
    * `{:duplicate, value: v}`
  """
  @type error :: {atom(), keyword()}

  @keys [:required, :min, :max, :create, :min_length, :max_length, :pattern]

  @doc """
  Rules from a keyword list (see the moduledoc), or the rules as they are.
  Raises an `ArgumentError` that says what is wrong.

      iex> Erabi.Rules.new(max: 3)
      %Erabi.Rules{max: 3}
  """
  @spec new(t() | keyword() | nil) :: t()
  def new(nil), do: %__MODULE__{}
  def new(%__MODULE__{} = rules), do: rules

  def new(opts) when is_list(opts) do
    case Keyword.keys(opts) -- @keys do
      [] ->
        :ok

      unknown ->
        raise ArgumentError,
              "Erabi.Rules: unknown rules #{inspect(unknown)}; the rules are #{inspect(@keys)}"
    end

    rules = struct(__MODULE__, opts)
    Enum.each(@keys, &check_key!(&1, Map.fetch!(rules, &1)))

    if rules.min && rules.max && rules.min > rules.max,
      do:
        raise(ArgumentError, "Erabi.Rules: :min (#{rules.min}) is more than :max (#{rules.max})")

    rules
  end

  defp check_key!(key, value) when key in [:required, :create] and not is_boolean(value),
    do:
      raise(
        ArgumentError,
        "Erabi.Rules: #{inspect(key)} is true or false, got: #{inspect(value)}"
      )

  defp check_key!(key, value)
       when key in [:min, :min_length] and not is_nil(value) and
              not (is_integer(value) and value >= 0),
       do: raise(ArgumentError, "Erabi.Rules: #{inspect(key)} is a count, got: #{inspect(value)}")

  defp check_key!(key, value)
       when key in [:max, :max_length] and not is_nil(value) and
              not (is_integer(value) and value > 0),
       do:
         raise(
           ArgumentError,
           "Erabi.Rules: #{inspect(key)} is a count of one or more, got: #{inspect(value)}"
         )

  defp check_key!(:pattern, pattern) when is_binary(pattern) do
    case Regex.compile("\\A(?:" <> pattern <> ")\\z", "u") do
      {:ok, _regex} ->
        :ok

      {:error, _reason} ->
        raise ArgumentError,
              "Erabi.Rules: :pattern is not a regular expression: #{inspect(pattern)}"
    end
  end

  defp check_key!(:pattern, %Regex{} = regex),
    do:
      raise(
        ArgumentError,
        "Erabi.Rules: :pattern is text (it runs in the browser too), got: #{inspect(regex)}; give #{inspect(Regex.source(regex))}"
      )

  defp check_key!(:pattern, pattern) when not is_nil(pattern),
    do: raise(ArgumentError, "Erabi.Rules: :pattern is text, got: #{inspect(pattern)}")

  defp check_key!(_key, _value), do: :ok

  @doc """
  Checks the values that a picker posts (texts, see
  `Erabi.Option.params/1`) against the rules: `:ok`, or the first reason
  they are refused. `known` is the values of the options, or `:any` when
  the options are not all known here (a search): then values are not
  refused for not being options.

      iex> rules = Erabi.Rules.new(max: 2)
      iex> Erabi.Rules.check(rules, ["a", "b", "c"], ["a", "b", "c"])
      {:error, {:too_many, [max: 2]}}
      iex> Erabi.Rules.check(rules, ["x"], ["a", "b"])
      {:error, {:not_allowed, [value: "x"]}}
  """
  @spec check(t(), [String.t()], [String.t()] | :any) :: :ok | {:error, error()}
  def check(%__MODULE__{} = rules, values, known) when is_list(values) do
    values = Enum.reject(values, &(&1 == ""))
    count = length(values)

    with :ok <- check_count(rules, count) do
      case duplicate(values) do
        nil -> check_new(rules, values, known)
        duplicate -> {:error, {:duplicate, value: duplicate}}
      end
    end
  end

  defp check_count(rules, count) do
    cond do
      rules.required and count == 0 -> {:error, {:required, []}}
      rules.min != nil and count > 0 and count < rules.min -> {:error, {:too_few, min: rules.min}}
      rules.max != nil and count > rules.max -> {:error, {:too_many, max: rules.max}}
      true -> :ok
    end
  end

  defp duplicate(values) do
    values
    |> Enum.reduce_while(MapSet.new(), fn value, seen ->
      if MapSet.member?(seen, value),
        do: {:halt, {:found, value}},
        else: {:cont, MapSet.put(seen, value)}
    end)
    |> case do
      {:found, value} -> value
      _seen -> nil
    end
  end

  # The values that are not options: refused without :create, else each
  # checked as a new value.
  defp check_new(_rules, _values, :any), do: :ok

  defp check_new(rules, values, known) do
    known = MapSet.new(known)

    values
    |> Enum.reject(&MapSet.member?(known, &1))
    |> Enum.find_value(:ok, fn value ->
      case check_value(rules, value) do
        :ok -> nil
        error -> error
      end
    end)
  end

  @doc """
  Checks a value that is not an option, as a person creates it: `:ok`, or
  why it cannot be.

      iex> Erabi.Rules.check_value(Erabi.Rules.new(create: true, max_length: 3), "four")
      {:error, {:too_long, [max_length: 3, value: "four"]}}
  """
  @spec check_value(t(), String.t()) :: :ok | {:error, error()}
  def check_value(%__MODULE__{} = rules, value) when is_binary(value) do
    length = String.length(value)

    cond do
      not rules.create ->
        {:error, {:not_allowed, value: value}}

      rules.min_length != nil and length < rules.min_length ->
        {:error, {:too_short, min_length: rules.min_length, value: value}}

      rules.max_length != nil and length > rules.max_length ->
        {:error, {:too_long, max_length: rules.max_length, value: value}}

      rules.pattern != nil and not Regex.match?(pattern(rules.pattern), value) ->
        {:error, {:format, value: value}}

      true ->
        :ok
    end
  end

  defp pattern(source), do: Regex.compile!("\\A(?:" <> source <> ")\\z", "u")

  @doc false
  # The rules as the browser gets them: only those that are set.
  @spec to_client(t()) :: map()
  def to_client(%__MODULE__{} = rules) do
    [
      {"required", rules.required || nil},
      {"min", rules.min},
      {"max", rules.max},
      {"create", rules.create || nil},
      {"minLength", rules.min_length},
      {"maxLength", rules.max_length},
      {"pattern", rules.pattern}
    ]
    |> Enum.reject(fn {_key, value} -> is_nil(value) end)
    |> Map.new()
  end
end
