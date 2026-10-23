defmodule Erabi.ChangesetTest do
  use ExUnit.Case, async: true

  import Ecto.Changeset

  doctest Erabi.Changeset

  @types %{
    status: Ecto.ParameterizedType.init(Ecto.Enum, values: [:todo, :doing, :done]),
    labels: {:array, :string},
    owner_id: :integer
  }

  defp cast_params(params), do: cast({%{}, @types}, params, Map.keys(@types))

  test "an Ecto.Enum value among the options" do
    assert cast_params(%{status: "doing"})
           |> Erabi.Changeset.validate_choice(:status, [required: true],
             options: [:todo, :doing, :done]
           )
           |> Map.get(:valid?)

    changeset = cast_params(%{}) |> Erabi.Changeset.validate_choice(:status, required: true)
    assert changeset.errors == [status: {"can't be blank", [validation: :erabi, kind: :required]}]
  end

  test "counts, with the count for translate_error" do
    changeset =
      cast_params(%{labels: ["a", "b", "c"]})
      |> Erabi.Changeset.validate_choice(:labels, [max: 2], options: ["a", "b", "c"])

    assert changeset.errors == [
             labels:
               {"should have at most %{count} values",
                [validation: :erabi, kind: :too_many, count: 2, max: 2]}
           ]
  end

  test "new values, checked as the browser does" do
    rules = [create: true, max_length: 5, pattern: "[a-z-]+"]

    assert cast_params(%{labels: ["bug", "new-x"]})
           |> Erabi.Changeset.validate_choice(:labels, rules, options: ["bug"])
           |> Map.get(:valid?)

    changeset =
      cast_params(%{labels: ["bug", "Nope"]})
      |> Erabi.Changeset.validate_choice(:labels, rules, options: ["bug"])

    assert [labels: {"has invalid format", [validation: :erabi, kind: :format, value: "Nope"]}] =
             changeset.errors
  end

  test "the options of a search: a function of the posted values" do
    existing = fn values ->
      Enum.filter(values, &(&1 in ["1", "2"])) |> Enum.map(&String.to_integer/1)
    end

    assert cast_params(%{owner_id: 2})
           |> Erabi.Changeset.validate_choice(:owner_id, [], options: existing)
           |> Map.get(:valid?)

    refute cast_params(%{owner_id: 9})
           |> Erabi.Changeset.validate_choice(:owner_id, [], options: existing)
           |> Map.get(:valid?)
  end

  test "messages of one's own, and an earlier error stays the only one" do
    changeset =
      cast_params(%{labels: ["a", "b"]})
      |> Erabi.Changeset.validate_choice(:labels, [max: 1], message: %{too_many: "one label"})

    assert [labels: {"one label", _}] = changeset.errors

    changeset =
      cast_params(%{owner_id: "x"}) |> Erabi.Changeset.validate_choice(:owner_id, required: true)

    assert [owner_id: {"is invalid", _}] = changeset.errors
  end
end
