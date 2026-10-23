defmodule Erabi do
  @moduledoc """
  Pickers for Phoenix LiveView: `select`, `multi_select`, `combobox`,
  `tags`, `person_picker` and `color_picker`, in `Erabi.Components`.

  Each picker is a field of a form: it posts what the browser's own
  control would, works with `Phoenix.HTML.FormField` and changesets, and
  is the browser's own control until its hook mounts. Its options are
  the app's (see `Erabi.Option`), or come from a search on the server
  (`Erabi.Live`). Its rules (`Erabi.Rules`) hold in the browser, as people
  choose, and on the server, in `Erabi.Changeset`.
  """

  @kinds ~w(select multi_select combobox tags person color)a

  @doc ~S"""
  A picker as the editor of a grid's cells, for a column of
  [Masu](https://hex.pm/packages/masu): the `editor` of the column, with
  its options, rules and words.

      <:col field={:labels} editor={Erabi.cell_editor(:multi_select, options: @labels, max: 3)} />

  The browser's half registers the editors once, in the app's JavaScript:

      import { configure } from "masu"
      import { erabiEditors } from "erabi"

      configure({ editors: erabiEditors() })

  The kinds are `:select`, `:multi_select`, `:combobox`, `:tags`,
  `:person` (with `multiple: true` for several people) and `:color`. The
  options are those of the components: `options`, `rules` and its
  shortcuts (`min`, `max`, `create`, `required`), `filter`, `me`,
  `placeholder`, `locale` and `messages`; and for `:color`, `palette`,
  `custom` and `contrast`, as `Erabi.Components.color_picker/1` takes
  them. A picker of one value saves it as it is chosen; one of several,
  when the editor closes, as the grid's own editors do; a color, when its
  popup closes, so that a drag in its area saves once.

  The color editor is in the color picker's entry, which the app imports
  too (`import "erabi/color"`); without it, a color column is a select
  of its palette.
  """
  @spec cell_editor(atom(), keyword()) :: {String.t(), map()}
  def cell_editor(kind, opts \\ []) when kind in @kinds do
    locale = Keyword.get(opts, :locale) || Application.get_env(:erabi, :locale, "en")
    messages = Erabi.Messages.for_locale(locale, Keyword.get(opts, :messages, %{}))
    opts = if kind == :color, do: color_opts(opts, messages), else: opts
    rules_opts = Keyword.take(opts, [:required, :min, :max, :create, :pattern])
    rules = opts |> Keyword.get(:rules) |> Erabi.Rules.new() |> Map.merge(Map.new(rules_opts))
    rules = rules |> Map.from_struct() |> Map.to_list() |> Erabi.Rules.new()

    options =
      %{
        "options" =>
          opts
          |> Keyword.get(:options, [])
          |> Erabi.Option.list()
          |> Enum.map(&Erabi.Option.to_wire/1),
        "rules" => Erabi.Rules.to_client(rules),
        "messages" => messages,
        "contrast" => opts[:contrast],
        "multiple" => Keyword.get(opts, :multiple, false),
        "filter" => Keyword.get(opts, :filter),
        "me" => opts[:me] && Erabi.Option.param(opts[:me]),
        "placeholder" => Keyword.get(opts, :placeholder)
      }
      |> Enum.reject(fn {_key, value} -> is_nil(value) end)
      |> Map.new()

    {"erabi_#{kind}", options}
  end

  # A color column's options: its palette (Erabi's nine by default), and
  # with `custom`, any color as #rrggbb.
  defp color_opts(opts, messages) do
    palette = opts[:palette] || opts[:options] || Erabi.Option.palette(messages)
    opts = Keyword.put(opts, :options, palette)

    if opts[:custom],
      do: Keyword.merge(opts, create: true, pattern: "#[0-9a-fA-F]{6}"),
      else: opts
  end

  @doc "The options of anything a picker takes; see `Erabi.Option.list/1`."
  @spec options(term()) :: [Erabi.Option.t()]
  defdelegate options(options), to: Erabi.Option, as: :list
end
