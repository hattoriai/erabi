defmodule Mix.Tasks.Erabi.BuildTest do
  # Builds the real bundles into priv/static, so it does not run in parallel
  # with other tests. It needs npm (and the network for the first `npm ci`),
  # so it runs only with `mix test --include build`.
  use ExUnit.Case, async: false

  @root Path.expand("../..", __DIR__)
  @static Path.join(@root, "priv/static")
  @files ~w(erabi.esm.js erabi.cjs.js erabi-color.esm.js erabi-color.cjs.js erabi-emoji.esm.js erabi-emoji.cjs.js erabi.css erabi-sumi.css)
  @exports ~w(Erabi cellEditor erabiEditors mountErabi)

  @moduletag :build
  @moduletag timeout: 600_000

  unless System.find_executable("npm") do
    @moduletag skip: "npm is not on the path, so mix erabi.build cannot run"
  end

  setup_all do
    # Files from an earlier build must not make the test pass, and a stray
    # file must be gone after the build.
    for file <- @files, do: File.rm(Path.join(@static, file))
    File.mkdir_p!(Path.join(@static, "stray"))
    File.write!(Path.join(@static, "stray/leftover.js"), "")

    mix = System.find_executable("mix") || flunk("mix is not on the path")

    {output, status} =
      System.cmd(mix, ["erabi.build"],
        cd: @root,
        env: [{"MIX_ENV", "dev"}],
        stderr_to_stdout: true
      )

    %{output: output, status: status}
  end

  test "mix erabi.build writes the bundles and the style sheets", %{
    output: output,
    status: status
  } do
    assert status == 0, "mix erabi.build failed:\n" <> output

    for file <- @files do
      path = Path.join(@static, file)
      assert File.regular?(path), "#{file} is missing"
      assert File.stat!(path).size > 0, "#{file} is empty"
    end
  end

  test "priv/static holds only the eight files of the package" do
    assert @static |> File.ls!() |> Enum.sort() == Enum.sort(@files)
  end

  test "the ESM bundle exports the hook, mountErabi and the cell editors" do
    esm = File.read!(Path.join(@static, "erabi.esm.js"))
    [exports] = Regex.run(~r/export\{([^}]*)\}/, esm, capture: :all_but_first)
    names = exports |> String.split(",") |> Enum.map(&(&1 |> String.split(" as ") |> List.last()))

    for name <- @exports, do: assert(name in names, "erabi.esm.js does not export #{name}")
  end

  describe "mix hex.build" do
    @describetag :tmp_dir

    test "packages the bundles and the guides, and no development files", %{tmp_dir: tmp_dir} do
      mix = System.find_executable("mix")
      out = Path.join(tmp_dir, "package")

      {output, status} =
        System.cmd(mix, ["hex.build", "--unpack", "--output", out],
          cd: @root,
          env: [{"MIX_ENV", "dev"}],
          stderr_to_stdout: true
        )

      assert status == 0, "mix hex.build failed:\n" <> output

      files =
        out
        |> Path.join("**")
        |> Path.wildcard(match_dot: true)
        |> Enum.filter(&File.regular?/1)
        |> Enum.map(&Path.relative_to(&1, out))

      for file <- @files do
        assert "priv/static/#{file}" in files, "the package has no priv/static/#{file}"
      end

      emoji =
        for language <- Erabi.Emoji.languages(),
            ext <- ~w(json json.gz),
            do: "priv/emoji/emoji-#{language}.#{ext}"

      assert files |> Enum.filter(&String.starts_with?(&1, "priv/")) |> Enum.sort() ==
               Enum.sort(Enum.map(@files, &"priv/static/#{&1}") ++ emoji)

      guides =
        @root
        |> Path.join("guides/*.md")
        |> Path.wildcard()
        |> Enum.map(&Path.relative_to(&1, @root))

      assert guides != []
      for guide <- guides, do: assert(guide in files, "the package has no #{guide}")

      for file <- files, prefix <- ~w(tmp/ dev/ e2e/ test/ assets/ deps/ _build/ doc/) do
        refute String.starts_with?(file, prefix), "the package has #{file}"
      end

      refute "dev.exs" in files
    end
  end

  describe "the CJS bundle" do
    if System.find_executable("node") == nil do
      @describetag skip: "node is not on the path, so the CJS bundle cannot be required"
    end

    test "require() of the package entry point gives the hook, mountErabi and the cell editors" do
      script = """
      const erabi = require("./priv/static/erabi.cjs.js");
      process.stdout.write(JSON.stringify(Object.keys(erabi).sort()));
      """

      {output, status} = System.cmd("node", ["-e", script], cd: @root, stderr_to_stdout: true)

      assert status == 0, "node could not require erabi.cjs.js:\n" <> output
      assert JSON.decode!(output) == Enum.sort(["internal" | @exports])
    end

    test "the color entry takes the rest from the package, not a copy of its own" do
      script = """
      const color = require("erabi/color");
      process.stdout.write(JSON.stringify(Object.keys(color)));
      """

      # The package resolves by its name from the directory above it.
      {output, status} =
        System.cmd("node", ["-e", script],
          cd: @root,
          env: [{"NODE_PATH", Path.dirname(@root)}],
          stderr_to_stdout: true
        )

      assert status == 0, "node could not require erabi/color:\n" <> output
      assert JSON.decode!(output) == ["ColorPicker"]

      esm = File.read!(Path.join(@static, "erabi-color.esm.js"))
      assert esm =~ ~r/from"erabi"/
      refute esm =~ "erabi-popup\""
    end

    test "the emoji entry takes the rest from the package too" do
      {output, status} =
        System.cmd(
          "node",
          ["-e", ~s{process.stdout.write(JSON.stringify(Object.keys(require("erabi/emoji"))))}],
          cd: @root,
          env: [{"NODE_PATH", Path.dirname(@root)}],
          stderr_to_stdout: true
        )

      assert status == 0, "node could not require erabi/emoji:\n" <> output
      assert JSON.decode!(output) == ["EmojiPicker"]
      refute File.read!(Path.join(@static, "erabi-emoji.esm.js")) =~ "erabi-popup\""
    end
  end
end

defmodule Mix.Tasks.Erabi.OwnProjectTest do
  # Mix.Project.in_project/4 changes the current Mix project for the whole
  # VM, so this module does not run in parallel with other tests.
  use ExUnit.Case, async: false

  alias Mix.Tasks.Erabi.{Build, ReleaseCheck}

  @moduletag :tmp_dir

  setup %{tmp_dir: tmp_dir} do
    File.write!(Path.join(tmp_dir, "mix.exs"), """
    defmodule ErabiHostApp.MixProject do
      use Mix.Project
      def project, do: [app: :erabi_host_app, version: "1.0.0"]
    end
    """)

    static = Path.join(tmp_dir, "priv/static")
    File.mkdir_p!(static)
    robots = Path.join(static, "robots.txt")
    File.write!(robots, "User-agent: *")

    %{robots: robots}
  end

  test "the guards accept only the Erabi project" do
    assert Build.ensure_erabi!(app: :erabi) == :ok
    assert ReleaseCheck.ensure_erabi!(app: :erabi) == :ok

    assert_raise Mix.Error, ~r/^mix erabi.build is for work on Erabi itself/, fn ->
      Build.ensure_erabi!(app: :my_app)
    end

    assert_raise Mix.Error, ~r/^mix erabi.release_check is for work on Erabi itself/, fn ->
      ReleaseCheck.ensure_erabi!(app: :my_app)
    end
  end

  test "mix erabi.build stops in an application and keeps its priv/static", %{
    tmp_dir: tmp_dir,
    robots: robots
  } do
    Mix.Project.in_project(:erabi_host_app, tmp_dir, fn _module ->
      assert_raise Mix.Error, ~r/an app gets the built files in the Hex package/, fn ->
        Build.run([])
      end
    end)

    assert File.read!(robots) == "User-agent: *"
  end

  test "mix erabi.release_check stops in an application", %{tmp_dir: tmp_dir} do
    Mix.Project.in_project(:erabi_host_app, tmp_dir, fn _module ->
      assert_raise Mix.Error, ~r/checks the files of a Erabi release/, fn ->
        ReleaseCheck.run([])
      end
    end)
  end
end
