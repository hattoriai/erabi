{:ok, _pid} = Phoenix.PubSub.Supervisor.start_link(name: ErabiTest.PubSub)
{:ok, _pid} = ErabiTest.Endpoint.start_link()
# The Issho instance of the pickers that show who is choosing
# (Erabi.Issho): everyone may do everything.
defmodule ErabiTest.Policy do
  @moduledoc false
  @behaviour Issho.Policy
  @impl true
  def authorize(_identity, _room, _action), do: :ok
end

{:ok, _pid} =
  Issho.start_link(
    name: ErabiTest.Issho,
    pubsub: ErabiTest.PubSub,
    policy: ErabiTest.Policy,
    secret_key_base: String.duplicate("erabi-test-secret-key-base-", 3),
    ttl: 50,
    awareness_interval: 5
  )

# The :build tests run `mix erabi.build` (npm and network on the first
# run) and `mix hex.build`: `mix test --include build`.
ExUnit.start(exclude: [:build])
