defmodule ErabiTest.ErrorHTML do
  @moduledoc "Error pages for the test endpoint."

  def render(template, _assigns), do: Phoenix.Controller.status_message_from_template(template)
end

defmodule ErabiTest.Router do
  @moduledoc "The router of the test endpoint."
  use Phoenix.Router

  import Phoenix.LiveView.Router

  pipeline :browser do
    plug(:fetch_session)
  end

  scope "/" do
    pipe_through(:browser)
    live("/form", ErabiTest.FormLive)
  end
end

defmodule ErabiTest.Endpoint do
  @moduledoc "A Phoenix endpoint for the `Erabi.Live` and `Erabi.Test` tests. It runs no server."
  use Phoenix.Endpoint, otp_app: :erabi

  plug(Plug.Session, store: :cookie, key: "_erabi_test", signing_salt: "erabi-test")
  plug(ErabiTest.Router)
end
