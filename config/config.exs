import Config

if config_env() == :dev do
  # The picker bundles. NODE_PATH is unset: the bundles never pick up a
  # package from deps/.
  esbuild_args = ~w(
    --bundle
    --minify
    --target=es2020
    --external:phoenix
    --external:phoenix_live_view
  )

  # The color picker and the emoji pickers are entries of their own
  # ("erabi/color", "erabi/emoji"), for the apps that have one: they take
  # the rest from "erabi", the page's copy.
  color_args = ~w(src/color-entry.ts --external:erabi)
  emoji_args = ~w(src/emoji-entry.ts --external:erabi)

  profile = fn args ->
    [
      args: esbuild_args ++ args,
      cd: Path.expand("../assets", __DIR__),
      env: %{"NODE_PATH" => nil}
    ]
  end

  config :esbuild,
    version: "0.28.2",
    erabi_esm: profile.(~w(src/index.ts --format=esm --outfile=../priv/static/erabi.esm.js)),
    erabi_cjs: profile.(~w(src/index.ts --format=cjs --outfile=../priv/static/erabi.cjs.js)),
    erabi_color_esm:
      profile.(color_args ++ ~w(--format=esm --outfile=../priv/static/erabi-color.esm.js)),
    erabi_color_cjs:
      profile.(color_args ++ ~w(--format=cjs --outfile=../priv/static/erabi-color.cjs.js)),
    erabi_emoji_esm:
      profile.(emoji_args ++ ~w(--format=esm --outfile=../priv/static/erabi-emoji.esm.js)),
    erabi_emoji_cjs:
      profile.(emoji_args ++ ~w(--format=cjs --outfile=../priv/static/erabi-emoji.cjs.js))
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
