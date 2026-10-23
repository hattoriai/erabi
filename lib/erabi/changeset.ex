defmodule Erabi.Changeset do
  @moduledoc """
  The rules of a picker (`Erabi.Rules`), checked on the server, in an
  `Ecto.Changeset`.

      def changeset(task, params) do
        task
        |> cast(params, [:status, :labels])
        |> Erabi.Changeset.validate_choice(:status, [required: true], options: Task.statuses())
        |> Erabi.Changeset.validate_choice(:labels, @label_rules, options: &Labels.existing/1)
      end

  It checks the field's value after the cast (an atom of an `Ecto.Enum`,
  an integer id, a list for `{:array, _}`), as the form posted it, and
  adds at most one error. The error has `validation: :erabi` and `kind:`
  (the reason, see `t:Erabi.Rules.error/0`) with what the message needs
  (`count`, `value`...), so that `translate_error/1` of a Phoenix app can
  translate it.

  Options:

    * `:options` - the options the value must be among (unless the rules
      have `create: true`): anything a picker takes, or a function of the
      posted values (texts) that gives the ones that exist, for options
      that come from a search (`&Labels.existing/1` with a query of
      `where: l.name in ^values`). Without it, any value is an option.
    * `:message` - a message for every error, or a map of messages by
      kind (`%{too_many: "three labels at most"}`).
  """

  import Ecto.Changeset

  alias Erabi.{Option, Rules}

  @messages %{
    required: "can't be blank",
    too_few: "should have at least %{count} values",
    too_many: "should have at most %{count} values",
    not_allowed: "is not one of the options",
    too_short: "should be at least %{count} characters",
    too_long: "should be at most %{count} characters",
    format: "has invalid format",
    duplicate: "has a value twice"
  }

  @doc """
  The default error messages, by kind. They follow Ecto's own, so that an
  app's Gettext already has most of them.

      iex> Erabi.Changeset.messages().required
      "can't be blank"
  """
  @spec messages() :: %{atom() => String.t()}
  def messages, do: @messages

  @doc """
  Checks the value of a field against the rules (an `Erabi.Rules` or its
  options) and the options. See the moduledoc.

      iex> types = %{labels: {:array, :string}}
      iex> changeset =
      ...>   {%{}, types}
      ...>   |> Ecto.Changeset.cast(%{labels: ["bug", "wontfix"]}, [:labels])
      ...>   |> Erabi.Changeset.validate_choice(:labels, [max: 3], options: ["bug", "feature"])
      iex> changeset.errors
      [labels: {"is not one of the options", [validation: :erabi, kind: :not_allowed, value: "wontfix"]}]
  """
  @spec validate_choice(Ecto.Changeset.t(), atom(), Rules.t() | keyword(), keyword()) ::
          Ecto.Changeset.t()
  def validate_choice(%Ecto.Changeset{} = changeset, field, rules, opts \\ []) do
    rules = Rules.new(rules)

    if Keyword.has_key?(changeset.errors, field) do
      changeset
    else
      values = changeset |> get_field(field) |> Option.params()

      case Rules.check(rules, values, known(opts[:options], values)) do
        :ok -> changeset
        {:error, error} -> add(changeset, field, error, opts)
      end
    end
  end

  defp known(nil, _values), do: :any
  defp known(fun, values) when is_function(fun, 1), do: fun |> apply([values]) |> Option.params()
  defp known(options, _values), do: options |> Option.list() |> Enum.map(&Option.param(&1.value))

  defp add(changeset, field, {kind, keys}, opts) do
    keys = with_count(kind, keys)

    add_error(
      changeset,
      field,
      message(kind, opts[:message]),
      [validation: :erabi, kind: kind] ++ keys
    )
  end

  # The count that Ecto's messages (and translate_error) interpolate.
  defp with_count(kind, keys) do
    case Keyword.take(keys, [:min, :max, :min_length, :max_length]) do
      [{_key, n}] when kind in [:too_few, :too_many, :too_short, :too_long] ->
        [{:count, n} | keys]

      _other ->
        keys
    end
  end

  defp message(kind, nil), do: Map.fetch!(@messages, kind)
  defp message(_kind, message) when is_binary(message), do: message
  defp message(kind, %{} = messages), do: Map.get(messages, kind) || Map.fetch!(@messages, kind)
end
