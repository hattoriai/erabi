defmodule Erabi.RulesTest do
  use ExUnit.Case, async: true

  alias Erabi.Rules

  doctest Erabi.Rules

  @keys %{
    "required" => :required,
    "min" => :min,
    "max" => :max,
    "create" => :create,
    "minLength" => :min_length,
    "maxLength" => :max_length,
    "pattern" => :pattern
  }

  # test/fixtures/rules.json holds the browser's rules (assets/src/rules.ts)
  # and these to the same answers.
  test "the fixture is what Erabi.Rules gives" do
    cases = "test/fixtures/rules.json" |> File.read!() |> JSON.decode!()

    for %{"rules" => rules, "values" => values, "known" => known, "expected" => expected} <- cases do
      rules =
        rules |> Enum.map(fn {key, value} -> {Map.fetch!(@keys, key), value} end) |> Rules.new()

      result =
        case Rules.check(rules, values, known || :any) do
          :ok ->
            nil

          {:error, {kind, keys}} ->
            Map.new([
              {"kind", Atom.to_string(kind)}
              | Enum.map(keys, fn {k, v} -> {Atom.to_string(k), v} end)
            ])
        end

      assert result == expected, "#{inspect(values)} with #{inspect(rules)}"
    end
  end

  test "the rules say what is wrong with them" do
    assert_raise ArgumentError, ~r/unknown rules \[:maximum\]/, fn -> Rules.new(maximum: 3) end
    assert_raise ArgumentError, ~r/:max is a count of one or more/, fn -> Rules.new(max: 0) end

    assert_raise ArgumentError, ~r/:min \(3\) is more than :max \(2\)/, fn ->
      Rules.new(min: 3, max: 2)
    end

    assert_raise ArgumentError, ~r/:pattern is text .* give "\[a-z\]\+"/, fn ->
      Rules.new(pattern: ~r/[a-z]+/)
    end

    assert_raise ArgumentError, ~r/not a regular expression/, fn -> Rules.new(pattern: "[a-") end
  end

  test "the browser gets only the rules that are set" do
    assert Rules.to_client(Rules.new(max: 3, create: true, max_length: 24)) ==
             %{"max" => 3, "create" => true, "maxLength" => 24}
  end
end
