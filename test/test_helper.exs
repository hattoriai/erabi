{:ok, _pid} = Phoenix.PubSub.Supervisor.start_link(name: ErabiTest.PubSub)
{:ok, _pid} = ErabiTest.Endpoint.start_link()
# The :build tests run `mix erabi.build` (npm and network on the first
# run) and `mix hex.build`: `mix test --include build`.
ExUnit.start(exclude: [:build])
