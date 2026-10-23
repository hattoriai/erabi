# Choosing together

With [Issho](https://hex.pm/packages/issho), a picker shows who else is
choosing in it: the people of the room who have it open, each in their
color, and the option each is on. An agent that changes a value goes to
the picker, opens it and moves to the option before the value lands, so
that the people see it choose.

A picker's value is not shared here: it is the value of the document
that holds it (a page's property, a row, a form), which your app saves
and shares as it does. Erabi carries only who is choosing, and where.

## The picker

```heex
<.select
  field={@form[:status]}
  options={@statuses}
  issho={[instance: MyApp.Issho, document: "page:42/status"]}
  user={@current_user}
/>
```

`issho` takes the keys of every component of the family (`Issho.Join`):
the picker's document names it in its room (the part before the first
`"/"`, so the pickers of a page share its people), and the LiveView joins
the room for it. `user` is the person, as `Issho.Actor` says them. Add
Issho to your deps (`{:issho, "~> 0.3"}`) and `on_mount Issho.Live` to the
LiveView.

## What people see

* On the field: the avatars of the others who have the picker open, and
  a ring in the color of the one choosing; its title says "Ada is
  choosing", and a screen reader hears it once.
* In the list, when they open it too: the option each one is on, marked
  with their avatar.
* When the list is closed on their screen: a peek of it, read-only, with
  the other's option marked in their color, moving as they move. It goes
  when they close the list, or when this person opens their own.

With Issho's pointers on the page, a person's pointer over an option is
that option on every screen, and an agent's pointer goes to it
(`Erabi.Issho`'s places, by the option's value).

## An agent

An agent's tool changes the value as the app does, in its own document,
and lets the people see it choose first:

```elixir
def call(%{"status" => status}, ctx) do
  {:ok, participant} = Issho.Tool.Context.join(ctx, "page:42")

  Erabi.Issho.choose(participant, "page:42/status", status, fn ->
    Pages.set_property(page, :status, status)
  end)
end
```

`Erabi.Issho.choose/5` goes to the picker (its list opens on the screens
that show it), then to the option, waits a moment there (`:pace`, 500
ms), runs the function, and leaves the picker. For a picker of several,
give the values: it goes to each in turn. The agent moves only for
someone who sees the picker, within Issho's time budget
(`Issho.Motion`); else the value lands at once.
