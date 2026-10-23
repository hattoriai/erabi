defmodule Erabi.MatchTest do
  use ExUnit.Case, async: true

  alias Erabi.Match

  doctest Erabi.Match

  # test/fixtures/match.json is Jumon's: the same rules, and the same
  # numbers, as Jumon.Match, which wrote it. The TypeScript matcher must
  # give them too (assets/test/match.test.ts).
  test "the fixture is what Erabi.Match gives" do
    cases = "test/fixtures/match.json" |> File.read!() |> JSON.decode!()
    assert length(cases) > 40

    for %{"action" => action, "query" => query, "expected" => expected} <- cases do
      option = %{
        label: action["name"],
        keywords: action["keywords"],
        hint: action["subtitle"],
        group: action["section"],
        priority: action["priority"]
      }

      result = Match.score(option, query)
      expected = expected && %{score: expected["score"], positions: expected["positions"]}
      assert result == expected, "#{inspect(query)} in #{inspect(action["name"])}"
    end
  end

  test "the fixture is Jumon's, as it is" do
    jumon = Path.expand("../../../jumon/test/fixtures/match.json", __DIR__)

    if File.exists?(jumon),
      do: assert(File.read!(jumon) == File.read!("test/fixtures/match.json"))
  end

  test "rank keeps the options that match, best first" do
    options = [%{label: "My home"}, %{label: "Homepage"}, %{label: "Home"}, %{label: "Away"}]

    assert options |> Match.rank("home") |> Enum.map(&elem(&1, 0).label) == [
             "Home",
             "Homepage",
             "My home"
           ]
  end

  test "an Erabi.Option is matched by its label, keywords and hint" do
    red = Erabi.Option.new(value: :red, label: "Red", keywords: ["crimson"])
    assert Match.score(red, "crimson")
    assert Match.score(Erabi.Option.new(value: 1, label: "Ada", hint: "Design"), "design")
  end
end
