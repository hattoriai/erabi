# The Erabi development server: `mix dev`, then http://localhost:4099.
#
# One Phoenix endpoint with every picker on a form, the built bundle from
# priv/static, a search on the server (and a slow one), and a list of
# thousands of options. The browser tests in e2e/ run against it.
#
# The bundle rebuilds and the page reloads on a change.
#
# Query params of every page: `locale` (a BCP 47 locale), `theme=sumi`,
# `dark=1`.
#
# Environment:
#
#   * PORT - the HTTP port (4099).
#   * ERABI_DEV_WATCH - "false" starts no esbuild watcher and no live
#     reload, for the browser tests; the bundle must be built first.

port = "PORT" |> System.get_env("4099") |> String.to_integer()
watch? = System.get_env("ERABI_DEV_WATCH") != "false"

Application.put_env(:phoenix, :json_library, JSON)
Logger.configure(level: :info)

Application.put_env(:erabi, ErabiDev.Endpoint,
  adapter: Bandit.PhoenixAdapter,
  check_origin: false,
  code_reloader: watch?,
  debug_errors: true,
  http: [ip: {127, 0, 0, 1}, port: port],
  live_view: [signing_salt: "erabi-dev-live-view-salt"],
  pubsub_server: ErabiDev.PubSub,
  render_errors: [formats: [html: ErabiDev.ErrorHTML], layout: false],
  secret_key_base: String.duplicate("erabi-development-secret-", 3),
  server: true,
  url: [host: "localhost"],
  watchers:
    if(watch?,
      do: [erabi_esm: {Esbuild, :install_and_run, [:erabi_esm, ~w(--watch)]}],
      else: []
    ),
  live_reload: [
    patterns: [
      ~r"priv/static/.*\.(js|css)$",
      ~r"lib/erabi/.*\.ex$"
    ]
  ]
)

defmodule ErabiDev.Data do
  @moduledoc "The made-up options of the development pages."

  def statuses do
    [
      %{value: :backlog, label: "Backlog", color: :gray, group: "Not started"},
      %{value: :todo, label: "To do", color: :blue, group: "Not started"},
      %{value: :doing, label: "In progress", color: :yellow, group: "Started"},
      %{value: :review, label: "In review", color: :purple, group: "Started"},
      %{value: :done, label: "Done", color: :green, group: "Finished"},
      %{
        value: :cancelled,
        label: "Cancelled",
        color: :red,
        group: "Finished",
        keywords: ["dropped"]
      }
    ]
  end

  def labels do
    [
      %{value: "bug", label: "Bug", color: :red, keywords: ["defect", "error"]},
      %{value: "feature", label: "Feature", color: :blue},
      %{value: "design", label: "Design", color: :pink},
      %{value: "docs", label: "Docs", color: :brown, keywords: ["documentation"]},
      %{value: "perf", label: "Performance", color: :orange},
      %{value: "a11y", label: "Accessibility", color: :purple, keywords: ["a11y"]},
      %{value: "security", label: "Security", color: :yellow},
      %{value: "good-first", label: "Good first issue", color: :green}
    ]
  end

  def priorities do
    [
      %{value: 0, label: "No priority", icon: "none"},
      %{value: 1, label: "Urgent", icon: "urgent", hint: "P1"},
      %{value: 2, label: "High", icon: "high", hint: "P2"},
      %{value: 3, label: "Medium", icon: "medium", hint: "P3"},
      %{value: 4, label: "Low", icon: "low", hint: "P4"}
    ]
  end

  def people do
    [
      %{id: 1, name: "Ada Lovelace", color: "#a45537", hint: "Engineering"},
      %{id: 2, name: "Grace Hopper", color: "#3f6f8f", hint: "Compilers"},
      %{id: 3, name: "Kenji Tanaka", color: "#5d7f3a", hint: "Design"},
      %{id: 4, name: "Linus Torvalds", color: "#8b4f86", hint: "Kernel"},
      %{id: 5, name: "Margaret Hamilton", color: "#b07a1f", hint: "Apollo"},
      %{id: 6, name: "Rui Freitas", color: "#2f7d74", hint: "Hattori"},
      %{id: 7, name: "Claude", kind: :agent, color: "#d97757", hint: "For Rui"},
      %{id: 8, name: "Reviewer", kind: :agent, color: "#56608f", hint: "Checks pull requests"}
    ]
  end

  @cities ~w(Lisbon Porto Coimbra Braga Faro Madrid Barcelona Valencia Seville Paris Lyon Marseille
    Berlin Munich Hamburg Cologne Rome Milan Naples Turin Amsterdam Rotterdam Utrecht Brussels Antwerp
    Vienna Zurich Geneva Prague Warsaw Krakow Budapest Copenhagen Stockholm Oslo Helsinki Dublin
    London Manchester Edinburgh Tokyo Osaka Kyoto Sapporo Seoul Busan Beijing Shanghai Shenzhen
    Mumbai Delhi Bangalore Sydney Melbourne Auckland Toronto Montreal Vancouver Chicago Boston
    Seattle Austin Denver Miami Atlanta Mexico Bogotá Lima Santiago São\ Paulo Rio\ de\ Janeiro
    Buenos\ Aires Cairo Lagos Nairobi Johannesburg Istanbul Athens Reykjavík Zürich Kraków)

  def cities, do: @cities |> Enum.uniq() |> Enum.map(&%{value: &1, label: &1})

  # A search of the cities, as an app's search of its database.
  def search_cities(query) do
    cities()
    |> Erabi.Match.rank(query)
    |> Enum.map(&elem(&1, 0))
  end

  # The same, slowly (async).
  def slow_cities(query) do
    Process.sleep(600)
    search_cities(query)
  end

  def items,
    do:
      for(
        n <- 1..5000,
        do: %{
          value: n,
          label: "Item #{String.pad_leading(to_string(n), 4, "0")}",
          hint: "Row #{n}"
        }
      )
end

defmodule ErabiDev.Task do
  @moduledoc "The schema of the form, with the rules the pickers have too."
  use Ecto.Schema
  import Ecto.Changeset

  @label_rules Erabi.Rules.new(max: 4)
  @tag_rules Erabi.Rules.new(
               create: true,
               max_length: 20,
               pattern: "[\\p{L}\\p{N}][\\p{L}\\p{N} -]*"
             )

  def label_rules, do: @label_rules
  def tag_rules, do: @tag_rules

  @primary_key false
  embedded_schema do
    field(:status, Ecto.Enum, values: [:backlog, :todo, :doing, :review, :done, :cancelled])
    field(:priority, :integer)
    field(:labels, {:array, :string}, default: [])
    field(:city, :string)
    field(:tags, {:array, :string}, default: [])
    field(:owner_id, :integer)
    field(:reviewer_ids, {:array, :integer}, default: [])
    field(:item, :integer)
  end

  def changeset(task, params) do
    task
    |> cast(params, [:status, :priority, :labels, :city, :tags, :owner_id, :reviewer_ids, :item])
    |> Erabi.Changeset.validate_choice(:status, [required: true],
      options: ErabiDev.Data.statuses()
    )
    |> Erabi.Changeset.validate_choice(:labels, @label_rules, options: ErabiDev.Data.labels())
    |> Erabi.Changeset.validate_choice(:tags, @tag_rules)
    |> Erabi.Changeset.validate_choice(:owner_id, [], options: ErabiDev.Data.people())
  end
end

defmodule ErabiDev.Layouts do
  @moduledoc """
  The root layout: the style sheets, the import map and the LiveSocket.
  `?theme=sumi` also loads erabi-sumi.css; `?dark=1` is the dark theme.
  """
  use Phoenix.Component

  def root(assigns) do
    # A controller's assigns have no change tracking: put, not assign.
    assigns = Map.put(assigns, :sumi, assigns.conn.params["theme"] == "sumi")

    ~H"""
    <!DOCTYPE html>
    <html lang="en" data-theme={@conn.params["dark"] && "dark"}>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="csrf-token" content={Plug.CSRFProtection.get_csrf_token()} />
        <title>Erabi development</title>
        <link rel="stylesheet" href="/assets/erabi.css" />
        <link :if={@sumi} rel="stylesheet" href="/assets/erabi-sumi.css" />
        <style>
          body { font-family: system-ui, sans-serif; margin: 0; background: var(--erabi-background); color: var(--erabi-text); }
          body.sumi { font-family: var(--erabi-font); }
          main { max-width: 52rem; margin: 0 auto; padding: 2rem 1rem 6rem; }
          nav a { margin-right: 1rem; color: inherit; }
          h1 { font-size: 1.5rem; margin: 1.5rem 0 0.25rem; }
          .lede { color: var(--erabi-muted); margin: 0 0 1.5rem; }
          .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(18rem, 1fr)); gap: 1.25rem 1.5rem; }
          .label { display: block; font-weight: 600; font-size: 0.875rem; margin: 0 0 0.375rem; }
          .error { color: var(--erabi-invalid); font-size: 0.8125rem; margin: 0.375rem 0 0; }
          pre { background: var(--erabi-surface); padding: 0.75rem; border-radius: 8px; font-size: 0.8125rem; overflow: auto; }
          .priority-icon { width: 16px; height: 16px; }
        </style>
        <script type="importmap">
          {
            "imports": {
              "phoenix": "/vendor/phoenix/phoenix.mjs",
              "phoenix_live_view": "/vendor/phoenix_live_view/phoenix_live_view.esm.js",
              "erabi": "/assets/erabi.esm.js"
            }
          }
        </script>
        <script type="module">
          import { Socket } from "phoenix"
          import { LiveSocket } from "phoenix_live_view"
          import { Erabi, mountErabi } from "erabi"

          if (document.querySelector("[data-phx-main]")) {
            const csrfToken = document.querySelector("meta[name='csrf-token']").getAttribute("content")
            const liveSocket = new LiveSocket("/live", Socket, {
              hooks: { Erabi },
              params: { _csrf_token: csrfToken }
            })
            liveSocket.connect()
            window.liveSocket = liveSocket
          } else {
            mountErabi()
          }
        </script>
      </head>
      <body class={@sumi && "sumi"}>
        <main>
          <nav>
            <a href="/">Pickers</a><a href="/plain">Without LiveView</a><a href="/?theme=sumi">Sumi</a><a href="/?dark=1">Dark</a><a href="/?locale=pt-PT">pt-PT</a>
          </nav>
          {@inner_content}
        </main>
      </body>
    </html>
    """
  end
end

defmodule ErabiDev.PickersLive do
  @moduledoc "Every picker on one form, with its errors and the params it posts."
  use Phoenix.LiveView

  import Erabi.Components

  alias ErabiDev.{Data, Task}

  on_mount(Erabi.Live)

  def mount(params, _session, socket) do
    task = %Task{status: :todo, labels: ["bug", "a11y"], owner_id: 6, reviewer_ids: [2, 7]}

    {:ok,
     assign(socket,
       locale: params["locale"],
       task: task,
       form: to_form(Task.changeset(task, %{}), as: :task),
       posted: %{},
       picked: nil
     )}
  end

  def render(assigns) do
    ~H"""
    <h1>Erabi</h1>
    <p class="lede">Pickers for Phoenix. Every picker posts as a native select would; the rules hold on both sides.</p>
    <.form for={@form} id="task-form" phx-change="validate" phx-submit="save">
      <div class="grid">
        <div>
          <label class="label" id="status-label">Status</label>
          <.select field={@form[:status]} options={Data.statuses()} label_id="status-label" locale={@locale} required />
          <.errors field={@form[:status]} />
        </div>
        <div>
          <label class="label" id="priority-label">Priority</label>
          <.select field={@form[:priority]} options={Data.priorities()} label_id="priority-label" locale={@locale}>
            <:icon :let={name}><.priority name={name} /></:icon>
          </.select>
        </div>
        <div>
          <label class="label" id="labels-label">Labels</label>
          <.multi_select field={@form[:labels]} options={Data.labels()} rules={Task.label_rules()} label_id="labels-label" locale={@locale} />
          <.errors field={@form[:labels]} />
        </div>
        <div>
          <label class="label" id="tags-label">Tags</label>
          <.tags field={@form[:tags]} options={["frontend", "backend", "infra", "mobile"]} rules={Task.tag_rules()} label_id="tags-label" locale={@locale} />
          <.errors field={@form[:tags]} />
        </div>
        <div>
          <label class="label" id="owner-label">Owner</label>
          <.person_picker field={@form[:owner_id]} people={Data.people()} me={6} label_id="owner-label" locale={@locale} />
          <.errors field={@form[:owner_id]} />
        </div>
        <div>
          <label class="label" id="reviewers-label">Reviewers</label>
          <.person_picker field={@form[:reviewer_ids]} people={Data.people()} me={6} multiple label_id="reviewers-label" locale={@locale} />
        </div>
        <div>
          <label class="label" id="city-label">City (a search on the server)</label>
          <.combobox field={@form[:city]} search={&Data.search_cities/1} label_id="city-label" locale={@locale} />
        </div>
        <div>
          <label class="label" id="slow-label">City (a slow search)</label>
          <.select name="slow" value={nil} search={&Data.slow_cities/1} async label_id="slow-label" locale={@locale} />
        </div>
        <div>
          <label class="label" id="item-label">One of 5,000</label>
          <.select field={@form[:item]} options={Data.items()} label_id="item-label" locale={@locale} />
        </div>
        <div>
          <label class="label" id="free-label">A city, or any place (create)</label>
          <.combobox name="place" value={nil} options={Data.cities()} create label_id="free-label" locale={@locale} />
        </div>
      </div>
      <p><button type="submit">Save</button></p>
    </.form>
    <h2>Outside a form</h2>
    <div style="max-width: 18rem">
      <.select name="view" value="board" options={[{"Board", "board"}, {"List", "list"}, {"Calendar", "calendar"}]} label="View" on_change="picked" />
    </div>
    <p>Picked: <span id="picked">{inspect(@picked)}</span></p>
    <h2>Posted</h2>
    <pre id="posted" data-json={JSON.encode!(@posted)}>{JSON.encode!(@posted)}</pre>
    """
  end

  defp errors(assigns) do
    ~H"""
    <p :for={{message, opts} <- @field.errors} :if={Phoenix.Component.used_input?(@field)} class="error">
      {Enum.reduce(opts, message, fn {key, value}, acc -> String.replace(acc, "%{#{key}}", to_string(value)) end)}
    </p>
    """
  end

  defp priority(assigns) do
    ~H"""
    <svg class="priority-icon" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <%= case @name do %>
        <% "urgent" -> %>
          <rect x="1" y="1" width="14" height="14" rx="3" fill="#e5484d" /><rect x="7" y="4" width="2" height="5" fill="#fff" /><rect x="7" y="10.5" width="2" height="2" fill="#fff" />
        <% "none" -> %>
          <rect x="2" y="7" width="3" height="2" rx="1" opacity=".5" /><rect x="6.5" y="7" width="3" height="2" rx="1" opacity=".5" /><rect x="11" y="7" width="3" height="2" rx="1" opacity=".5" />
        <% level -> %>
          <% bars = %{"high" => 3, "medium" => 2, "low" => 1}[level] %>
          <rect x="2" y="9" width="3" height="5" rx="1" opacity={if bars >= 1, do: "1", else: ".3"} /><rect x="6.5" y="6" width="3" height="8" rx="1" opacity={if bars >= 2, do: "1", else: ".3"} /><rect x="11" y="3" width="3" height="11" rx="1" opacity={if bars >= 3, do: "1", else: ".3"} />
      <% end %>
    </svg>
    """
  end

  def handle_event("validate", %{"task" => params} = all, socket) do
    changeset = socket.assigns.task |> Task.changeset(params) |> Map.put(:action, :validate)

    {:noreply,
     assign(socket, form: to_form(changeset, as: :task), posted: Map.drop(all, ["_target"]))}
  end

  def handle_event("validate", params, socket),
    do: {:noreply, assign(socket, posted: Map.drop(params, ["_target"]))}

  def handle_event("save", %{"task" => params} = all, socket) do
    changeset = socket.assigns.task |> Task.changeset(params) |> Map.put(:action, :insert)
    {:noreply, assign(socket, form: to_form(changeset, as: :task), posted: all)}
  end

  def handle_event("picked", %{"value" => value}, socket),
    do: {:noreply, assign(socket, picked: value)}
end

defmodule ErabiDev.PlainHTML do
  use Phoenix.Component
  import Erabi.Components

  def index(assigns) do
    ~H"""
    <h1>Without LiveView</h1>
    <form id="plain-form" action="/plain" method="get">
      <label class="label" id="plain-label">Labels</label>
      <.multi_select name="labels" value={@labels} options={ErabiDev.Data.labels()} label_id="plain-label" />
      <p><button type="submit">Send</button></p>
    </form>
    <pre id="query">{@query}</pre>
    """
  end
end

defmodule ErabiDev.PlainController do
  use Phoenix.Controller, formats: [:html]

  def index(conn, params) do
    labels = params |> Map.get("labels", ["docs"]) |> List.wrap() |> Enum.reject(&(&1 == ""))

    conn
    |> put_view(ErabiDev.PlainHTML)
    |> render(:index, labels: labels, query: conn.query_string)
  end
end

defmodule ErabiDev.Router do
  use Phoenix.Router
  import Phoenix.LiveView.Router

  pipeline :browser do
    plug(:accepts, ["html"])
    plug(:fetch_session)
    plug(:fetch_live_flash)
    plug(:protect_from_forgery)
    plug(:put_root_layout, html: {ErabiDev.Layouts, :root})
  end

  scope "/" do
    pipe_through(:browser)

    live("/", ErabiDev.PickersLive)
    get("/plain", ErabiDev.PlainController, :index)
  end
end

defmodule ErabiDev.ErrorHTML do
  def render(template, _assigns), do: Phoenix.Controller.status_message_from_template(template)
end

defmodule ErabiDev.Endpoint do
  use Phoenix.Endpoint, otp_app: :erabi

  @session [store: :cookie, key: "_erabi_dev", signing_salt: "erabi-dev"]

  socket("/live", Phoenix.LiveView.Socket, websocket: [connect_info: [session: @session]])

  if System.get_env("ERABI_DEV_WATCH") != "false" do
    socket("/phoenix/live_reload/socket", Phoenix.LiveReloader.Socket)
    plug(Phoenix.LiveReloader)
    plug(Phoenix.CodeReloader)
  end

  plug(Plug.Static, at: "/assets", from: Path.expand("priv/static", __DIR__))
  plug(Plug.Static, at: "/vendor/phoenix", from: {:phoenix, "priv/static"})
  plug(Plug.Static, at: "/vendor/phoenix_live_view", from: {:phoenix_live_view, "priv/static"})

  plug(Plug.Parsers, parsers: [:urlencoded, :json], pass: ["*/*"], json_decoder: JSON)
  plug(Plug.Session, @session)
  plug(ErabiDev.Router)
end

# The script's process ends after this file, so the server runs in a task
# that stays alive; `mix run --no-halt` keeps the VM up.
Task.async(fn ->
  if watch?, do: {:ok, _apps} = Application.ensure_all_started(:esbuild)

  {:ok, _pid} =
    Supervisor.start_link(
      [{Phoenix.PubSub, name: ErabiDev.PubSub}, ErabiDev.Endpoint],
      strategy: :one_for_one
    )

  IO.puts("Erabi development server: http://localhost:#{port}")
  Process.sleep(:infinity)
end)
