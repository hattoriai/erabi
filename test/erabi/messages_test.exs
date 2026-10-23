defmodule Erabi.MessagesTest do
  use ExUnit.Case, async: true

  doctest Erabi.Messages

  test "every language has every key, and the placeholders of English" do
    english = Erabi.Messages.Translations.english()

    for {language, words} <- Erabi.Messages.Translations.all() do
      assert Map.keys(words) -- Map.keys(english) == [], "#{language} has unknown keys"
      assert Map.keys(english) -- Map.keys(words) == [], "#{language} lacks keys"

      for {key, text} <- words do
        placeholders = fn text ->
          ~r/\{\w+\}/ |> Regex.scan(text) |> List.flatten() |> Enum.sort()
        end

        assert placeholders.(text) == placeholders.(english[key]), "#{language}: #{key}"
      end
    end
  end

  test "an unknown key is a typo, said" do
    assert_raise ArgumentError, ~r/unknown message keys \["chose"\]/, fn ->
      Erabi.Messages.for_locale("en", %{"chose" => "x"})
    end
  end
end
