defmodule Erabi do
  @moduledoc """
  Pickers for Phoenix LiveView: `select`, `multi_select`, `combobox`,
  `tags` and `person_picker`, in `Erabi.Components`.

  Each picker is a field of a form: it posts what the browser's own
  control would, works with `Phoenix.HTML.FormField` and changesets, and
  is the browser's own control until its hook mounts. Its options are
  the app's (see `Erabi.Option`), or come from a search on the server
  (`Erabi.Live`). Its rules (`Erabi.Rules`) hold in the browser, as people
  choose, and on the server, in `Erabi.Changeset`.
  """

  @doc "The options of anything a picker takes; see `Erabi.Option.list/1`."
  @spec options(term()) :: [Erabi.Option.t()]
  defdelegate options(options), to: Erabi.Option, as: :list
end
