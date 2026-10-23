import Config

if config_env() == :dev do
  # The picker bundles. NODE_PATH is unset: the bundles never pick up a
  # package from deps/.
  esbuild_args = ~w(
    src/index.ts
    --bundle
    --minify
    --target=es2020
    --external:phoenix
    --external:phoenix_live_view
  )

  config :esbuild,
    version: "0.28.2",
    erabi_esm: [
      args: esbuild_args ++ ~w(--format=esm --outfile=../priv/static/erabi.esm.js),
      cd: Path.expand("../assets", __DIR__),
      env: %{"NODE_PATH" => nil}
    ],
    erabi_cjs: [
      args: esbuild_args ++ ~w(--format=cjs --outfile=../priv/static/erabi.cjs.js),
      cd: Path.expand("../assets", __DIR__),
      env: %{"NODE_PATH" => nil}
    ]
end

if config_env() == :test do
  config :logger, level: :warning
  config :phoenix, :json_library, JSON

  config :erabi, ErabiTest.Endpoint,
    secret_key_base: String.duplicate("erabi-test-secret-key-base-", 4),
    live_view: [signing_salt: "erabi-test-salt"],
    pubsub_server: ErabiTest.PubSub,
    render_errors: [formats: [html: ErabiTest.ErrorHTML], layout: false],
    server: false
end
