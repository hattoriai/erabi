defmodule Erabi.Emoji do
  @moduledoc """
  The emoji of the emoji picker (`Erabi.Components.emoji_picker/1`), on
  the server: their names in a language, a search by name, and a check
  that a value is an emoji, for a changeset or an agent's tool.

  The data is [Emojibase](https://emojibase.dev)'s (MIT), one file a
  language in `priv/emoji` of the Erabi package: every emoji, in
  Emojibase's order, with its name and tags in English, Portuguese, Spanish, French, German,
  Italian, Dutch and Japanese, GitHub's shortcodes, and its skin tones.

  ## Serving the data

  The picker fetches the data of the page's language the first time it
  opens, from your app (the browser keeps it). Serve the files from your
  endpoint, above its own `Plug.Static` (`mix erabi.install` adds it):

      plug Plug.Static, at: "/erabi/emoji", from: {:erabi, "priv/emoji"}, gzip: true

  Elsewhere, set the path the pickers fetch from:

      config :erabi, emoji_url: "/assets/erabi-emoji"

  ## In a changeset

      |> Erabi.Changeset.validate_choice(:icon, [], options: Erabi.Emoji.options(@icons))

  ## For an agent

      Erabi.Emoji.find("party")
      #=> [%{emoji: "🎉", name: "party popper", ...}, ...]
  """

  @languages ~w(en pt es fr de it nl ja)

  @typedoc "An emoji: its text, name and keywords in a language, category, skin tones and shortcode."
  @type t :: %{
          emoji: String.t(),
          name: String.t(),
          keywords: [String.t()],
          group: non_neg_integer(),
          tones: [String.t()] | nil,
          shortcode: String.t() | nil
        }

  @doc """
  The languages of the emoji names.

      iex> Erabi.Emoji.languages()
      ["en", "pt", "es", "fr", "de", "it", "nl", "ja"]
  """
  @spec languages() :: [String.t()]
  def languages, do: @languages

  @doc """
  The language of the emoji names for a locale: its language, when the
  data has it, else English.

      iex> Erabi.Emoji.language("pt-PT")
      "pt"
      iex> Erabi.Emoji.language("ko")
      "en"
  """
  @spec language(String.t() | nil) :: String.t()
  def language(nil), do: "en"

  def language(locale) do
    language = locale |> String.downcase() |> String.split(["-", "_"]) |> hd()
    if language in @languages, do: language, else: "en"
  end

  @doc """
  The path the pickers fetch the data of a locale from: `config :erabi,
  emoji_url:` (`"/erabi/emoji"` by default), and the file of the locale's
  language.

      iex> Erabi.Emoji.url("fr-CA")
      "/erabi/emoji/emoji-fr.json"
  """
  @spec url(String.t() | nil) :: String.t()
  def url(locale) do
    base = :erabi |> Application.get_env(:emoji_url, "/erabi/emoji") |> String.trim_trailing("/")
    "#{base}/emoji-#{language(locale)}.json"
  end

  @doc """
  Every emoji, in Emojibase's order, named in the locale's language.
  """
  @spec all(String.t() | nil) :: [t()]
  def all(locale \\ "en"), do: Enum.map(data(language(locale)).emoji, &public/1)

  @doc """
  The name of an emoji (or of one of its skin tones) in the locale's
  language, or nil when it is not an emoji.

      iex> Erabi.Emoji.name("🎉")
      "party popper"
      iex> Erabi.Emoji.name("👋🏽", "de")
      "winkende Hand"
      iex> Erabi.Emoji.name("party")
      nil
  """
  @spec name(String.t(), String.t() | nil) :: String.t() | nil
  def name(emoji, locale \\ "en") when is_binary(emoji) do
    case Map.get(data(language(locale)).by_text, emoji) do
      nil -> nil
      entry -> entry.name
    end
  end

  @doc """
  Whether a text is an emoji of the data, or one of its skin tones.

      iex> Erabi.Emoji.emoji?("👍🏿")
      true
      iex> Erabi.Emoji.emoji?("thumbs up")
      false
  """
  @spec emoji?(term()) :: boolean()
  def emoji?(text) when is_binary(text), do: Map.has_key?(data("en").by_text, text)
  def emoji?(_other), do: false

  @doc """
  The emoji that match a query, best first, as the picker ranks them:
  each word of the query starts a word of the emoji's name, tags or
  shortcodes in the locale's language (case, accents and width aside; in
  Japanese, anywhere in them). A word of the name counts more than a
  tag's, a whole word more than its start, a shortcode that is the word
  more still, and a name that is the query most of all; then shorter
  names, then Unicode's order. The browser's search is the same.

  Options: `:locale` (English by default) and `:limit` (20).

      iex> Erabi.Emoji.find("party popper") |> hd() |> Map.take([:emoji, :name])
      %{emoji: "🎉", name: "party popper"}
  """
  @spec find(String.t(), keyword()) :: [t()]
  def find(query, opts \\ []) when is_binary(query) do
    query
    |> rank(Keyword.get(opts, :locale, "en"))
    |> Enum.take(Keyword.get(opts, :limit, 20))
  end

  defp rank(query, locale) do
    whole = query |> String.trim() |> Erabi.Match.fold()
    words = split(whole)
    whole = Enum.join(words, " ")
    entries = data(language(locale)).emoji

    if words == [],
      do: Enum.map(entries, &public/1),
      else: matches(entries, words, whole)
  end

  defp matches(entries, words, whole) do
    entries
    |> Enum.with_index()
    |> Enum.flat_map(&scored(&1, words, whole))
    |> Enum.sort()
    |> Enum.map(fn {_score, _index, entry} -> public(entry) end)
  end

  defp scored({entry, index}, words, whole) do
    case score(entry.folded, words, whole) do
      0 -> []
      score -> [{-score, index, entry}]
    end
  end

  defp public(entry), do: Map.delete(entry, :folded)

  @unspaced ~r/[\p{Han}\p{Hiragana}\p{Katakana}]/u

  defp split(text), do: String.split(text, ~r/[^\p{L}\p{N}_+]+/u, trim: true)

  defp score(folded, words, whole) do
    Enum.reduce_while(words, 0, fn word, total ->
      case word_score(folded, word) do
        0 -> {:halt, 0}
        score -> {:cont, total + score}
      end
    end)
    |> case do
      0 ->
        0

      total ->
        extra =
          cond do
            folded.name == whole -> 100
            String.starts_with?(folded.name, whole) -> 40
            true -> 0
          end

        total + extra - min(length(String.to_charlist(folded.name)), 40) / 10
    end
  end

  defp word_score(%{code: code}, word) when code != "" and code == word, do: 36

  defp word_score(folded, word) do
    case max(name_score(folded, word), keyword_score(folded, word)) do
      0 -> unspaced_score(folded, word)
      best -> best
    end
  end

  defp name_score(folded, word) do
    cond do
      word in folded.name_words -> 30
      Enum.any?(folded.name_words, &String.starts_with?(&1, word)) -> 20
      true -> 0
    end
  end

  # A whole keyword; else the start of one of its words.
  defp keyword_score(folded, word) do
    if word in folded.keywords,
      do: 16,
      else:
        folded.keyword_words |> Enum.map(&keyword_word_score(&1, word)) |> Enum.max(fn -> 0 end)
  end

  defp keyword_word_score(word, word), do: 14

  defp keyword_word_score(w, word),
    do: if(String.starts_with?(w, word), do: 10, else: 0)

  # In Japanese and Chinese, anywhere in a name or keyword.
  defp unspaced_score(folded, word) do
    if Regex.match?(@unspaced, word) and
         (String.contains?(folded.name, word) or
            Enum.any?(folded.keywords, &String.contains?(&1, word))),
       do: 8,
       else: 0
  end

  @doc """
  The options of a field of an emoji picker, for
  `Erabi.Changeset.validate_choice/4`: a function of the posted values
  that gives those that are emoji, and the app's icons (options with an
  `:icon`, by their values).

      iex> Erabi.Emoji.options([%{value: "rocket", label: "Rocket", icon: "rocket"}]).(["🎉", "rocket", "nope"])
      ["🎉", "rocket"]
  """
  @spec options(list()) :: ([String.t()] -> [String.t()])
  def options(icons \\ []) do
    names = icons |> Erabi.Option.list() |> MapSet.new(&Erabi.Option.param(&1.value))
    fn values -> Enum.filter(values, &(emoji?(&1) or MapSet.member?(names, &1))) end
  end

  # The data of a language, read once, kept in :persistent_term.
  defp data(language) do
    key = {__MODULE__, language}

    case :persistent_term.get(key, nil) do
      nil ->
        data = read(language)
        :persistent_term.put(key, data)
        data

      data ->
        data
    end
  end

  defp read(language) do
    %{"emoji" => rows} =
      :erabi
      |> Application.app_dir("priv/emoji/emoji-#{language}.json")
      |> File.read!()
      |> JSON.decode!()

    emoji = Enum.map(rows, &entry/1)

    by_text =
      for entry <- emoji, text <- [entry.emoji | entry.tones || []], into: %{}, do: {text, entry}

    %{emoji: emoji, by_text: by_text}
  end

  defp entry([emoji, name, keywords, group, _version, tones, shortcode]) do
    folded_name = Erabi.Match.fold(name)
    folded_keywords = Enum.map(keywords, &Erabi.Match.fold/1)

    %{
      emoji: emoji,
      name: name,
      keywords: keywords,
      group: group,
      tones: if(tones == 0, do: nil, else: tones),
      shortcode: if(shortcode == "", do: nil, else: shortcode),
      folded: %{
        code: Erabi.Match.fold(shortcode),
        name: folded_name,
        name_words: split(folded_name),
        keywords: folded_keywords,
        keyword_words: Enum.flat_map(folded_keywords, &split/1)
      }
    }
  end
end
