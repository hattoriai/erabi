defmodule Erabi.Match do
  @moduledoc """
  How a picker matches and ranks options as a person types, in Elixir.

  The browser filters the options it has with the same rules, and the
  same numbers (`test/fixtures/match.json` holds the two to the same
  results), so this module says what a picker shows: `Erabi.Test` uses
  it, and a search of your own can rank with it on the server.

  The rules are Jumon's, whose palette ranks its commands so:

    * case, accents and the width of characters do not count: "cafe"
      finds "Café", "ｈｏｍｅ" finds "Home";
    * each word of the query must be found in the option, its letters in
      order (a subsequence): "nwiss" finds "New issue";
    * a letter scores more at the start of the label or of a word, and
      after the letter before it; letters far apart score less;
    * a word is found in the label first, then in the keywords, the hint
      and the group, each scoring less, and there only as letters next to
      each other;
    * a word of four letters or more that is not found may have one typo
      (a letter missing, added, changed, or two letters swapped) against
      the start of a word of the label or of a keyword: "isue" finds
      "Issues";
    * the label equal to the query, then a label that starts with it,
      rank first; a shorter label ranks before a longer one;
    * the option's `:priority` is added to its score.
  """

  @base 16
  @start_bonus 24
  @word_bonus 16
  @consecutive 20
  @lead_cap 12
  @exact 1000
  @prefix 200
  @keyword_cost 40
  @subtitle_cost 60
  @section_cost 80
  @typo 8

  @typedoc "The score of an option, and the positions in its label to highlight."
  @type result :: %{score: integer(), positions: [non_neg_integer()]}

  @doc """
  Folds a text for matching: decomposed (NFKD), without combining marks,
  in lower case, character by character.

  ## Examples

      iex> Erabi.Match.fold("Café ＡＢ")
      "cafe ab"

  """
  @spec fold(String.t()) :: String.t()
  def fold(text) when is_binary(text) do
    text |> String.codepoints() |> Enum.map_join(&fold_char/1)
  end

  defp fold_char(char) do
    char
    |> :unicode.characters_to_nfkd_binary()
    |> String.replace(~r/\p{Mn}/u, "")
    |> String.downcase()
  end

  @doc """
  The score of an option for a query, or `nil` when it does not match.
  The positions are the characters of the label, by index, that the query
  matched. An option is an `Erabi.Option`, or a map with `:label` (and
  `:keywords`, `:hint`, `:group`, `:priority`).

  ## Examples

      iex> Erabi.Match.score(%{label: "New issue"}, "nis").positions
      [0, 4, 5]
      iex> Erabi.Match.score(%{label: "New issue"}, "xyz")
      nil

  """
  @spec score(map(), String.t()) :: result() | nil
  def score(option, query) when is_map(option) and is_binary(query) do
    item = item(option)

    case query |> fold() |> String.split(~r/\s+/u, trim: true) do
      [] -> %{score: item.priority, positions: []}
      words -> score_words(item, words)
    end
  end

  # The fields an option is matched by, in the matcher's terms.
  defp item(option) do
    %{
      name: to_string(Map.get(option, :label) || ""),
      keywords: Enum.map(Map.get(option, :keywords) || [], &to_string/1),
      subtitle: text(Map.get(option, :hint)),
      section: text(Map.get(option, :group)),
      priority: Map.get(option, :priority) || 0
    }
  end

  defp text(nil), do: nil
  defp text(value), do: to_string(value)

  @doc """
  Ranks options for a query: those that match, best first, each with its
  score and positions. Options with the same score keep their order. With
  an empty query, every option, by `:priority`.
  """
  @spec rank([map()], String.t()) :: [{map(), result()}]
  def rank(options, query) when is_list(options) and is_binary(query) do
    options
    |> Enum.with_index()
    |> Enum.flat_map(fn {option, index} ->
      case score(option, query) do
        nil -> []
        result -> [{option, result, index}]
      end
    end)
    |> Enum.sort_by(fn {_option, result, index} -> {-result.score, index} end)
    |> Enum.map(fn {option, result, _index} -> {option, result} end)
  end

  defp score_words(item, words) do
    fields = fields(item)
    name = elem(fields, 0)

    case match_words(words, fields) do
      {:ok, total, positions} ->
        %{
          score:
            total + whole_bonus(name.text, Enum.join(words, " ")) -
              div(min(tuple_size(name.chars), 40), 4) + item.priority,
          positions:
            positions |> Enum.map(&Map.fetch!(name.origin, &1)) |> Enum.uniq() |> Enum.sort()
        }

      :error ->
        nil
    end
  end

  defp fields(item) do
    {
      folded(item.name),
      Enum.map(item.keywords, &folded/1),
      item.subtitle && folded(item.subtitle),
      item.section && folded(item.section)
    }
  end

  # Each word must be found; the scores add up, and the positions join.
  defp match_words(words, fields) do
    Enum.reduce_while(words, {:ok, 0, []}, fn word, {:ok, total, positions} ->
      case best(word, fields) do
        nil -> {:halt, :error}
        {score, found} -> {:cont, {:ok, total + score, positions ++ found}}
      end
    end)
  end

  defp whole_bonus(text, text), do: @exact

  defp whole_bonus(text, whole) do
    if String.starts_with?(text, whole), do: @prefix, else: 0
  end

  # A field, folded: its folded characters, and for each the index of the
  # character of the original text that it came from.
  defp folded(text) do
    {chars, origin} =
      text
      |> String.codepoints()
      |> Enum.with_index()
      |> Enum.flat_map(fn {char, index} ->
        char |> fold_char() |> String.codepoints() |> Enum.map(&{&1, index})
      end)
      |> Enum.unzip()

    origin = origin |> Enum.with_index() |> Map.new(fn {original, i} -> {i, original} end)
    %{text: Enum.join(chars), chars: List.to_tuple(chars), origin: origin}
  end

  # The best score of a word in the fields, with the positions in the name:
  # the name, then the keywords, the subtitle and the section, each costing
  # more; then one typo.
  defp best(word, {name, keywords, subtitle, section}) do
    query = word |> String.codepoints() |> List.to_tuple()

    found =
      max_result([
        subsequence(query, name.chars),
        keywords
        |> Enum.map(&contiguous(subsequence(query, &1.chars)))
        |> max_result()
        |> cost(@keyword_cost),
        subtitle && cost(contiguous(subsequence(query, subtitle.chars)), @subtitle_cost),
        section && cost(contiguous(subsequence(query, section.chars)), @section_cost)
      ])

    found || typo(query, name, keywords)
  end

  # The best result of a list; the first wins a tie.
  defp max_result(results) do
    Enum.reduce(results, nil, fn
      nil, best -> best
      result, nil -> result
      result, best -> if elem(result, 0) > elem(best, 0), do: result, else: best
    end)
  end

  # A match of letters next to each other, else nil: the other fields of
  # an option only match so.
  defp contiguous(nil), do: nil

  defp contiguous({_score, positions} = result) do
    if List.last(positions) - hd(positions) == length(positions) - 1, do: result
  end

  defp cost(nil, _cost), do: nil
  defp cost({score, _positions}, cost), do: {score - cost, []}

  # The best alignment of the query's characters in order in the text, by
  # dynamic programming: {score, positions} or nil. Each row maps the
  # indexes of the text where a character of the query can be to
  # {score, index of the character before}.
  defp subsequence(query, text)
       when tuple_size(query) == 0 or tuple_size(query) > tuple_size(text),
       do: nil

  defp subsequence(query, text) do
    first =
      for j <- 0..(tuple_size(text) - 1), elem(text, j) == elem(query, 0), into: %{} do
        {j, {bonus(text, j) - min(j, @lead_cap), nil}}
      end

    rows =
      Enum.reduce(1..(tuple_size(query) - 1)//1, [first], fn i, rows ->
        [row(query, text, i, hd(rows)) | rows]
      end)

    case best_end(hd(rows)) do
      nil -> nil
      j -> {elem(hd(rows)[j], 0), backtrack(rows, j, [])}
    end
  end

  defp row(query, text, i, previous) do
    char = elem(query, i)

    {row, _best} =
      Enum.reduce(0..(tuple_size(text) - 1), {%{}, nil}, fn j, {row, best} ->
        best = gap_best(best, previous, j)
        {put_cell(row, j, cell(text, char, previous, best, i, j)), best}
      end)

    row
  end

  # The best earlier match with a gap, from the matches before j - 1, as
  # {score + its index, its index}: the gap costs one for each character.
  defp gap_best(best, previous, j) when j >= 2 do
    case previous[j - 2] do
      {score, _from} -> better_gap(best, {score + j - 2, j - 2})
      nil -> best
    end
  end

  defp gap_best(best, _previous, _j), do: best

  defp better_gap(nil, candidate), do: candidate
  defp better_gap({score, _} = best, {candidate, _}) when candidate <= score, do: best
  defp better_gap(_best, candidate), do: candidate

  defp cell(text, char, previous, best, i, j) do
    if j >= i and elem(text, j) == char do
      gap = best && {elem(best, 0) - (j - 1), elem(best, 1)}

      case pick(consecutive(previous, j), gap) do
        nil -> nil
        {score, from} -> {bonus(text, j) + score, from}
      end
    end
  end

  defp consecutive(previous, j) do
    case previous[j - 1] do
      {score, _from} -> {score + @consecutive, j - 1}
      nil -> nil
    end
  end

  defp put_cell(row, _j, nil), do: row
  defp put_cell(row, j, cell), do: Map.put(row, j, cell)

  # The consecutive match wins a tie.
  defp pick(nil, gap), do: gap
  defp pick(consecutive, nil), do: consecutive
  defp pick({a, _} = consecutive, {b, _}) when a >= b, do: consecutive
  defp pick(_consecutive, gap), do: gap

  # The end of the best alignment; the first wins a tie.
  defp best_end(row) do
    row
    |> Map.keys()
    |> Enum.sort()
    |> Enum.reduce(nil, fn j, best ->
      if best == nil or elem(row[j], 0) > elem(row[best], 0), do: j, else: best
    end)
  end

  defp backtrack([row | rest], j, acc) do
    case row[j] do
      {_score, nil} -> [j | acc]
      {_score, from} -> backtrack(rest, from, [j | acc])
    end
  end

  defp bonus(_text, 0), do: @base + @start_bonus

  defp bonus(text, j) do
    if alnum?(elem(text, j - 1)), do: @base, else: @base + @word_bonus
  end

  defp alnum?(char), do: String.match?(char, ~r/\A[\p{L}\p{N}]\z/u)

  # One typo against the start of a word of the name, then of a keyword.
  defp typo(query, _name, _keywords) when tuple_size(query) < 4, do: nil

  defp typo(query, name, keywords) do
    word = Tuple.to_list(query)
    n = length(word)

    case typo_in(word, name.chars) do
      {start, size} -> {@typo * n, Enum.to_list(start..(start + size - 1))}
      nil -> if Enum.any?(keywords, &typo_in(word, &1.chars)), do: {@typo * n - @keyword_cost, []}
    end
  end

  # The first word of the text whose start is at most one edit from the
  # query word: {start, size of the start}.
  defp typo_in(word, chars) do
    chars |> words() |> Enum.find_value(&typo_at(word, &1))
  end

  defp typo_at(word, {start, token}) do
    n = length(word)
    Enum.find_value([n, n - 1, n + 1], &(near?(word, token, &1) && {start, &1}))
  end

  defp near?(word, token, size) do
    prefix = Enum.take(token, size)
    size > 0 and length(prefix) == size and distance(word, prefix) <= 1
  end

  defp words(chars) do
    chars
    |> Tuple.to_list()
    |> Enum.with_index()
    |> Enum.chunk_by(fn {char, _index} -> alnum?(char) end)
    |> Enum.filter(fn [{char, _index} | _rest] -> alnum?(char) end)
    |> Enum.map(fn [{_char, start} | _rest] = chunk -> {start, Enum.map(chunk, &elem(&1, 0))} end)
  end

  # The optimal string alignment distance: insertions, deletions,
  # substitutions and swaps of two neighbours.
  defp distance(a, b) do
    a = List.to_tuple(a)
    b = List.to_tuple(b)

    table =
      for i <- 0..tuple_size(a), j <- 0..tuple_size(b), reduce: %{} do
        table -> Map.put(table, {i, j}, edit(a, b, table, i, j))
      end

    table[{tuple_size(a), tuple_size(b)}]
  end

  defp edit(_a, _b, _table, 0, j), do: j
  defp edit(_a, _b, _table, i, 0), do: i

  defp edit(a, b, table, i, j) do
    cost = if elem(a, i - 1) == elem(b, j - 1), do: 0, else: 1

    best =
      Enum.min([table[{i - 1, j}] + 1, table[{i, j - 1}] + 1, table[{i - 1, j - 1}] + cost])

    if swapped?(a, b, i, j), do: min(best, table[{i - 2, j - 2}] + 1), else: best
  end

  defp swapped?(a, b, i, j) do
    i > 1 and j > 1 and elem(a, i - 1) == elem(b, j - 2) and elem(a, i - 2) == elem(b, j - 1)
  end
end
