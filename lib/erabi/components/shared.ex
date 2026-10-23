defmodule Erabi.Components.Shared do
  @moduledoc false

  # The attributes that every picker of Erabi.Components has, declared
  # once. `shared_attrs/0` expands into `attr` calls, in the component
  # module, before each picker function.

  defmacro shared_attrs do
    quote do
      attr :field, Phoenix.HTML.FormField,
        default: nil,
        doc: "the form field, for example `@form[:status]`"

      attr :id, :string,
        default: nil,
        doc: "the id of the picker element; the default is the field's id with `_picker`"

      attr :name, :string, default: nil, doc: "the input name, without a `field`"
      attr :value, :any, default: nil, doc: "the value, without a `field`"

      attr :options, :list,
        default: [],
        doc:
          "the options: anything a `<select>` takes, or maps with colors, hints and icons (see `Erabi.Option`)"

      attr :selected, :list,
        default: [],
        doc:
          "options of the chosen values that are not in `options`, for their labels (the options of a search)"

      attr :search, :any,
        default: nil,
        doc:
          "a function that finds options for a query, run in the LiveView by `Erabi.Live` (see the Search guide)"

      attr :async, :boolean,
        default: false,
        doc: "when `true`, the search runs in a task (`start_async`)"

      attr :filter, :boolean,
        default: nil,
        doc: "whether the list has a box to filter it; the default is `true` from 10 options"

      attr :label_id, :string,
        default: nil,
        doc:
          "the id of the element that labels the picker (`aria-labelledby`); a `<label for>` of the field works too"

      attr :label, :string,
        default: nil,
        doc: "the accessible name when there is no label; the default is the field name in words"

      attr :placeholder, :string, default: nil, doc: "the words of an empty picker"

      attr :rules, :any,
        default: nil,
        doc: "the rules, an `Erabi.Rules` or its options; give the same to `Erabi.Changeset`"

      attr :min, :integer, default: nil, doc: "a shortcut for the `:min` rule"
      attr :max, :integer, default: nil, doc: "a shortcut for the `:max` rule"
      attr :create, :boolean, default: nil, doc: "a shortcut for the `:create` rule"
      attr :required, :boolean, default: false

      attr :clearable, :boolean,
        default: nil,
        doc:
          "whether a picker of one value has a clear button; the default is `true` unless `required`"

      attr :disabled, :boolean, default: false
      attr :readonly, :boolean, default: false

      attr :locale, :string,
        default: nil,
        doc:
          "a BCP 47 locale for the words and numbers; the default is `config :erabi, locale:`, else \"en\""

      attr :messages, :map,
        default: nil,
        doc: "words that replace the built-in ones, see `Erabi.Messages`"

      attr :on_change, :string,
        default: nil,
        doc:
          "an event that the picker pushes with `%{\"id\", \"value\"}` on each change, for a picker outside a form"

      attr :issho, :any,
        default: nil,
        doc:
          "with Issho, the picker's document in a room, to show who is choosing in it: `[instance: MyApp.Issho, document: \"page:42/status\"]` (see `Erabi.Issho`)"

      attr :user, :any,
        default: nil,
        doc: "the person choosing, with `issho`, as `Issho.Actor` says them"

      attr :class, :any, default: nil, doc: "classes for the picker element"

      attr :rest, :global,
        include: ~w(form),
        doc:
          "attributes for the picker element, such as `phx-target`; `aria-describedby` goes to the field"

      slot :icon, doc: "draws an option's `:icon`, given its name (`:let={name}`)"
    end
  end
end
