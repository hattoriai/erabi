defmodule Erabi.EmojiTest do
  use ExUnit.Case, async: true

  import Phoenix.Component
  import Phoenix.LiveViewTest
  import Erabi.Components

  doctest Erabi.Emoji

  defp config(html) do
    [json] =
      html
      |> LazyHTML.from_fragment()
      |> LazyHTML.query("[phx-hook=Erabi]")
      |> LazyHTML.attribute("data-config")

    JSON.decode!(json)
  end

  test "every language has every emoji, in the same order" do
    english = Enum.map(Erabi.Emoji.all("en"), & &1.emoji)
    assert length(english) > 1800

    for language <- Erabi.Emoji.languages() do
      assert Enum.map(Erabi.Emoji.all(language), & &1.emoji) == english
    end
  end

  test "the search finds by name, tag and shortcode, in the page's language" do
    first = fn query, opts -> query |> Erabi.Emoji.find(opts) |> hd() |> Map.fetch!(:emoji) end

    assert first.("thumbs up", []) == "👍"
    assert first.("+1", []) == "👍"
    assert first.(":tada:", []) == "🎉"
    assert first.("smile", []) == "😄"
    assert first.("coração vermelho", locale: "pt-BR") == "❤️"
    assert first.("ハート", locale: "ja") == "♥️"
    assert Erabi.Emoji.find("nothing like this", []) == []
  end

  test "the server ranks as the browser does (assets/test/emojisearch.test.ts)" do
    top = fn query -> query |> Erabi.Emoji.find(limit: 5) |> Enum.map(& &1.emoji) end
    assert top.("party") == ["🎉", "🥳", "🪅", "🪇", "🪩"]
    assert top.("cat") == ["🐈", "🐱", "😼", "😹", "🙀"]
  end

  test "an emoji picker: its data in the page's language, and the name of its value" do
    assigns = %{form: to_form(%{"icon" => "🎉"}, as: :page)}

    html =
      rendered_to_string(~H"""
      <.emoji_picker field={@form[:icon]} locale="fr" tones={false} />
      """)

    config = config(html)

    assert %{"kind" => "emoji", "emojiData" => "/erabi/emoji/emoji-fr.json", "noTones" => true} =
             config

    assert [%{"v" => "🎉", "l" => "cotillons"}] = config["selected"]
    assert html =~ ~s(<option value="🎉" selected>)
    assert config["messages"]["searchEmoji"] == "Rechercher un emoji…"
  end

  test "an icon picker: the app's icons, drawn by its slot" do
    assigns = %{icons: [%{value: "rocket", label: "Rocket", icon: "rocket"}]}

    html =
      rendered_to_string(~H"""
      <.icon_picker name="icon" value="rocket" options={@icons}>
        <:icon :let={name}><svg data-name={name} /></:icon>
      </.icon_picker>
      """)

    assert %{"kind" => "icon", "icons" => true} = config(html)
    assert html =~ ~s(class="erabi erabi-icon-picker")
    assert html =~ ~s(<template data-erabi-icon="rocket">)
  end

  test "the changeset takes emoji, their tones and the app's icons, and nothing else" do
    types = %{icon: :string}
    options = Erabi.Emoji.options([%{value: "rocket", label: "Rocket", icon: "rocket"}])

    check = fn value ->
      {%{}, types}
      |> Ecto.Changeset.cast(%{icon: value}, [:icon])
      |> Erabi.Changeset.validate_choice(:icon, [], options: options)
      |> Map.fetch!(:valid?)
    end

    assert check.("🎉")
    assert check.("👋🏾")
    assert check.("rocket")
    refute check.("party")
  end

  test "an emoji column of a grid" do
    assert {"erabi_emoji", %{"emojiData" => "/erabi/emoji/emoji-ja.json"}} =
             Erabi.cell_editor(:emoji, locale: "ja")
  end
end
