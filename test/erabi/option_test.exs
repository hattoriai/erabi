defmodule Erabi.OptionTest do
  use ExUnit.Case, async: true

  alias Erabi.Option

  doctest Erabi.Option

  defmodule User do
    defstruct [:id, :name, :email]
  end

  test "anything a select takes, and richer" do
    assert [%{value: "Draft", label: "Draft"}] = Option.list(["Draft"])
    assert [%{value: :todo, label: "To do"}] = Option.list([{"To do", :todo}])
    assert [%{value: :todo, label: "To do"}] = Option.list(todo: "To do")
    assert [%{value: 3, label: "3"}] = Option.list([3])

    assert [%{value: "apple", group: "Fruit"}, %{value: "leek", group: "Vegetable"}] =
             Option.list([{"Fruit", ["apple"]}, {"Vegetable", ["leek"]}])

    assert [%{value: 1, label: "Ada", color: :blue, hint: "Design"}] =
             Option.list([
               %{"value" => 1, "label" => "Ada", "color" => :blue, "hint" => "Design"}
             ])
  end

  test "a user struct is an option by its id and name" do
    assert [%{value: 7, label: "Ada"}] = Option.list([%User{id: 7, name: "Ada", email: "ada@x"}])
  end

  test "what is wrong with an option, said" do
    assert_raise ArgumentError, ~r/two options have the value "a"/, fn ->
      Option.list(["a", "a"])
    end

    assert_raise ArgumentError, ~r/:color is one of/, fn -> Option.new(value: 1, color: :teal) end

    assert_raise ArgumentError, ~r/:color is one of/, fn ->
      Option.new(value: 1, color: "red;}body{x:y")
    end

    assert Option.new(value: 1, color: "oklch(70% 0.1 200)").color == "oklch(70% 0.1 200)"
    assert_raise ArgumentError, ~r/needs a :value/, fn -> Option.new(label: "x") end
  end

  test "the browser gets short keys, only those that are set" do
    option = Option.new(value: :todo, label: "To do", color: :gray, keywords: ["open"])

    assert Option.to_wire(option) == %{
             "v" => "todo",
             "l" => "To do",
             "c" => "gray",
             "k" => ["open"]
           }
  end
end
