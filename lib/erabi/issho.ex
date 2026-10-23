if Code.ensure_loaded?(Issho.Motion) do
  defmodule Erabi.Issho do
    @moduledoc ~S"""
    People and agents seen choosing, with
    [Issho](https://hex.pm/packages/issho): a picker shows who has it
    open and the option they are on, and an agent that changes a value
    goes to the picker, opens it, and moves to the option before the
    value lands, for the people who watch.

    A picker's value is not shared here: it is the value of the document
    that holds it (a page's property, a row, a form), which your app saves
    and shares as it does. Erabi carries only who is choosing, and where.

    ## The picker

        <.select
          field={@form[:status]}
          options={@statuses}
          issho={[instance: MyApp.Issho, document: "page:42/status"]}
          user={@current_user}
        />

    `issho` takes the keys of every component of the family
    (`Issho.Join`): the picker's document names it in its room (the part
    before the first `"/"`), and the LiveView joins that room for it. The
    `user` is the person, as `Issho.Actor` says them.

    The people of the room who have the picker open show on its field,
    each in their color; the option each is on is marked in the list, and
    when the list is closed on a screen, a peek of it shows the option they
    move to. Issho's pointers find a picker's places by their options.

    ## An agent

    An agent's tool changes the value as the app does, in its own
    document, and lets the people see it choose first:

        def call(%{"status" => status}, ctx) do
          {:ok, participant} = Issho.Tool.Context.join(ctx, "page:42")

          Erabi.Issho.choose(participant, "page:42/status", status, fn ->
            Pages.set_property(page, :status, status)
          end)
        end

    `choose/4` moves the agent to the picker (its list opens on the
    screens that show it), then to the option, and waits a moment there
    (`:pace`), then runs the function, then leaves the picker. The agent
    moves only for someone who sees the picker, within Issho's time budget
    (`Issho.Motion`); else the value lands at once.

    ## Places

    A place in a picker is `%{"open" => true, "option" => value}` (the
    option a person or an agent is on, its list open), or `%{}` (the
    field), in the room as the `"at"` of the picker's document:

        %{"doc" => "page:42/status", "at" => %{"open" => true, "option" => "done"}}

    The option is its value as the picker posts it (text).
    """

    alias Issho.{Motion, Participant}

    @pace 500

    @doc """
    Moves an agent through a picker as it chooses `value` (or several,
    for a picker of several), runs `fun` (the app's change), and leaves the
    picker; gives what `fun` gives.

    Options: `:pace`, how long the agent stays on each option before it
    takes it (#{@pace} ms; 0 for none), and `:travel` (`false`: the agent
    is there at once, as `Issho.Motion` says).
    """
    @spec choose(GenServer.server(), String.t(), term(), (-> result), keyword()) :: result
          when result: term()
    def choose(participant, document, value, fun, opts \\ []) when is_function(fun, 0) do
      travel = Keyword.get(opts, :travel, true)
      pace = Keyword.get(opts, :pace, @pace)

      :ok = Motion.go(participant, place(document, %{}), travel: travel)

      for option <- Erabi.Option.params(value) do
        target = place(document, %{"open" => true, "option" => option})
        :ok = Motion.go(participant, target, travel: travel)
        if pace > 0, do: Motion.pause(participant, target, pace)
      end

      try do
        fun.()
      after
        Participant.place(participant, nil)
      end
    end

    @doc """
    A place of a picker, for `Issho.Motion` or a participant's place:
    `%{"doc" => document, "at" => at}`.

        iex> Erabi.Issho.place("page:42/status", %{"open" => true, "option" => "done"})
        %{"doc" => "page:42/status", "at" => %{"open" => true, "option" => "done"}}
    """
    @spec place(String.t(), map()) :: map()
    def place(document, at) when is_binary(document) and is_map(at),
      do: %{"doc" => document, "at" => at}

    @doc """
    Checks a place in a picker (its `"at"`): `:ok`, or an error.

        iex> Erabi.Issho.validate(%{"open" => true, "option" => "done"})
        :ok
        iex> Erabi.Issho.validate(%{"cell" => [1, "a"]})
        {:error, :invalid_place}
    """
    @spec validate(term()) :: :ok | {:error, :invalid_place}
    def validate(nil), do: :ok

    def validate(%{} = at) do
      if Enum.all?(at, &part?/1), do: :ok, else: {:error, :invalid_place}
    end

    def validate(_other), do: {:error, :invalid_place}

    defp part?({"open", open}), do: is_boolean(open)
    defp part?({"option", option}), do: is_binary(option) and byte_size(option) <= 200

    defp part?({coordinate, value}) when coordinate in ["x", "y"],
      do: is_number(value) and value >= 0 and value <= 1

    defp part?(_other), do: false
  end
end
