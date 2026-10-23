defmodule Mix.Tasks.Erabi.ReleaseCheck do
  @shortdoc "Checks that priv/static holds the eight bundle files and nothing else"

  @moduledoc """
  Checks the built files before a release of Erabi.

      $ mix erabi.release_check

  This task is for work on Erabi itself; the `release` alias runs it
  after `mix erabi.build` and before `mix hex.publish`. In any project
  but Erabi, it stops with an error. It fails when:

    * one of the eight bundle files (`erabi.esm.js`, `erabi.cjs.js`,
      `erabi-color.esm.js`, `erabi-color.cjs.js`, `erabi-emoji.esm.js`,
      `erabi-emoji.cjs.js`, `erabi.css` and
      `erabi-sumi.css`) is missing from `priv/static`,
      or is empty (the empty files that CI makes are not a build);
    * `priv/static` holds any other file or directory;
    * the emoji data of a language (`priv/emoji/emoji-<language>.json`,
      and its `.gz`) is missing or empty (`npm run emoji` in `assets/`
      makes it);
    * the `version` of `package.json` is not the version of `mix.exs`.
  """

  use Mix.Task

  @static "priv/static"
  @files ~w(erabi.esm.js erabi.cjs.js erabi-color.esm.js erabi-color.cjs.js erabi-emoji.esm.js erabi-emoji.cjs.js erabi.css erabi-sumi.css)

  @impl Mix.Task
  def run(_args) do
    config = Mix.Project.config()
    ensure_erabi!(config)
    version = config[:version]

    result =
      case {check(@static, "package.json", version), emoji_problems("priv/emoji")} do
        {:ok, []} -> :ok
        {:ok, emoji} -> {:error, emoji}
        {{:error, problems}, emoji} -> {:error, problems ++ emoji}
      end

    case result do
      :ok ->
        Mix.shell().info(
          "#{@static} holds the eight bundle files, and nothing else, and package.json has version #{version}"
        )

      {:error, problems} ->
        Mix.raise("""
        Erabi is not ready for a release:

        #{Enum.map_join(problems, "\n", &("  * " <> &1))}

        Build with `mix erabi.build` (it empties #{@static} first); keep the \
        version of package.json equal to the version of mix.exs.\
        """)
    end
  end

  @doc false
  @spec ensure_erabi!(keyword()) :: :ok
  def ensure_erabi!(config) do
    if config[:app] == :erabi do
      :ok
    else
      Mix.raise(
        "mix erabi.release_check is for work on Erabi itself; it checks the files of a Erabi release"
      )
    end
  end

  @doc false
  @spec check(Path.t(), Path.t(), String.t()) :: :ok | {:error, [String.t()]}
  def check(static, package_json, version) do
    entries =
      case File.ls(static) do
        {:ok, entries} -> entries
        {:error, _reason} -> []
      end

    problems =
      Enum.flat_map(@files, &bundle_problems(static, &1, entries)) ++
        Enum.map(Enum.sort(entries -- @files), &"#{static}/#{&1} is not a bundle file") ++
        version_problems(package_json, version)

    if problems == [], do: :ok, else: {:error, problems}
  end

  defp bundle_problems(static, file, entries) do
    path = Path.join(static, file)

    cond do
      file not in entries -> ["#{path} is missing"]
      not File.regular?(path) -> ["#{path} is not a file"]
      File.stat!(path).size == 0 -> ["#{path} is empty"]
      true -> []
    end
  end

  @doc false
  @spec emoji_problems(Path.t()) :: [String.t()]
  def emoji_problems(dir) do
    for language <- Erabi.Emoji.languages(),
        file <- ["emoji-#{language}.json", "emoji-#{language}.json.gz"],
        problem <- bundle_problems(dir, file, File.ls!(dir)),
        do: problem
  rescue
    File.Error -> ["#{dir} is missing"]
  end

  defp version_problems(package_json, version) do
    with {:ok, source} <- File.read(package_json),
         {:ok, %{"version" => ^version}} <- JSON.decode(source) do
      []
    else
      _other -> ["the version of #{package_json} is not #{version}"]
    end
  end
end
