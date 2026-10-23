defmodule Erabi.ComponentsTest do
  use ExUnit.Case, async: true

  import Phoenix.Component
  import Phoenix.LiveViewTest
  import Erabi.Components

  defp task_form(params \\ %{}, opts \\ []), do: to_form(params, Keyword.merge([as: :task], opts))

  defp count(doc, selector), do: doc |> LazyHTML.query(selector) |> Enum.count()

  defp config(html) do
    [json] =
      html
      |> LazyHTML.from_fragment()
      |> LazyHTML.query("[phx-hook=Erabi]")
      |> LazyHTML.attribute("data-config")

    JSON.decode!(json)
  end

  defp value(html) do
    [json] =
      html
      |> LazyHTML.from_fragment()
      |> LazyHTML.query("[phx-hook=Erabi]")
      |> LazyHTML.attribute("data-value")

    JSON.decode!(json)
  end

  test "a select is a native select of its options until the hook mounts" do
    assigns = %{form: task_form(%{"status" => "doing"})}

    html =
      rendered_to_string(~H"""
      <.select field={@form[:status]} options={[{"To do", :todo}, {"Doing", :doing}]} />
      """)

    doc = LazyHTML.from_fragment(html)

    assert 1 ==
             count(
               doc,
               ~s(div#task_status_picker[phx-hook="Erabi"][phx-update="ignore"])
             )

    assert 1 == count(doc, ~s(select#task_status[name="task[status]"].erabi-native))
    assert ["doing"] = doc |> LazyHTML.query("option[selected]") |> LazyHTML.attribute("value")
    assert ["", "todo", "doing"] = doc |> LazyHTML.query("option") |> LazyHTML.attribute("value")
    assert value(html) == ["doing"]

    config = config(html)
    assert %{"kind" => "select", "label" => "Status", "clearable" => true} = config

    assert config["options"] == [
             %{"v" => "todo", "l" => "To do"},
             %{"v" => "doing", "l" => "Doing"}
           ]

    refute config["multiple"]
  end

  test "a picker of several posts name[], after an empty value" do
    assigns = %{form: task_form(%{"labels" => ["bug", "docs"]})}

    html =
      rendered_to_string(~H"""
      <.multi_select field={@form[:labels]} options={["bug", "docs", "feature"]} max={2} />
      """)

    doc = LazyHTML.from_fragment(html)

    assert [""] =
             doc
             |> LazyHTML.query(~s(input[type="hidden"][name="task[labels][]"]))
             |> LazyHTML.attribute("value")

    assert 1 == count(doc, ~s(select[multiple][name="task[labels][]"]))

    assert ["bug", "docs"] =
             doc |> LazyHTML.query("option[selected]") |> LazyHTML.attribute("value")

    assert %{"multiple" => true, "rules" => %{"max" => 2}} = config(html)
  end

  test "rules: the shortcuts over the rules given" do
    assigns = %{form: task_form()}

    html =
      rendered_to_string(~H"""
      <.tags field={@form[:tags]} rules={[create: true, max_length: 12]} max={5} required />
      """)

    assert config(html)["rules"] == %{
             "create" => true,
             "maxLength" => 12,
             "max" => 5,
             "required" => true
           }

    assert html =~ ~s(required)
  end

  test "the labels of chosen values that are not options, from `selected`" do
    assigns = %{form: task_form(%{"city" => "7"})}

    html =
      rendered_to_string(~H"""
      <.combobox field={@form[:city]} search={fn _ -> [] end} selected={[%{value: 7, label: "Lisbon"}]} />
      """)

    assert %{"search" => true, "selected" => [%{"v" => "7", "l" => "Lisbon"}]} = config(html)
    assert html =~ ~s(<option value="7" selected>)
    assert html =~ "Lisbon"
  end

  test "a value that is no option still posts, as itself" do
    assigns = %{form: task_form(%{"tags" => ["new-one"]})}

    html =
      rendered_to_string(~H"""
      <.tags field={@form[:tags]} options={["a"]} create />
      """)

    assert html =~ ~s(<option value="new-one" selected>)
  end

  test "people: avatars' colors and kinds, and me" do
    assigns = %{form: task_form(%{"owner" => 2})}

    html =
      rendered_to_string(~H"""
      <.person_picker field={@form[:owner]} people={[%{id: 1, name: "Ada", color: :blue}, %{id: 2, name: "Claude", kind: :agent}]} me={%{id: 1}} />
      """)

    config = config(html)
    assert %{"kind" => "person", "me" => "1"} = config

    assert [
             %{"v" => "1", "l" => "Ada", "c" => "blue"},
             %{"v" => "2", "l" => "Claude", "p" => "agent"}
           ] = config["options"]
  end

  test "groups are optgroups of the native select" do
    assigns = %{}

    html =
      rendered_to_string(~H"""
      <.select name="fruit" value="pear" options={[{"Fruit", ["apple", "pear"]}, {"Vegetable", ["leek"]}]} label="Fruit" />
      """)

    assert ["Fruit", "Vegetable"] =
             html
             |> LazyHTML.from_fragment()
             |> LazyHTML.query("optgroup")
             |> LazyHTML.attribute("label")
  end

  test "an invalid field says so to the native select and the picker" do
    form =
      to_form(%{"status" => ""},
        as: :task,
        errors: [status: {"can't be blank", []}],
        action: :validate
      )

    assigns = %{form: form}

    html =
      rendered_to_string(~H"""
      <.select field={@form[:status]} options={["a"]} aria-describedby="status-error" />
      """)

    assert html =~ ~s(aria-invalid="true")
    assert html =~ ~s(aria-describedby="status-error")
    assert %{"invalid" => true, "describedBy" => "status-error"} = config(html)
  end

  test "icons are the app's, drawn once each, in templates" do
    assigns = %{}

    html =
      rendered_to_string(~H"""
      <.select name="p" value={nil} label="Priority" options={[%{value: 1, label: "High", icon: "up"}, %{value: 2, label: "Low", icon: "down"}]}>
        <:icon :let={name}><i class={"icon-#{name}"}></i></:icon>
      </.select>
      """)

    assert ["up", "down"] =
             html
             |> LazyHTML.from_fragment()
             |> LazyHTML.query("template")
             |> LazyHTML.attribute("data-erabi-icon")

    assert %{"icons" => true} = config(html)
  end

  test "words in the picker's locale" do
    assigns = %{}

    html =
      rendered_to_string(~H"""
      <.select name="s" value={nil} options={["a"]} locale="pt-PT" label="S" />
      """)

    assert %{"locale" => "pt-PT", "messages" => %{"choose" => "Escolher…"}} = config(html)
    assert html =~ "Escolher…"
  end

  test "what is wrong, said" do
    assigns = %{}

    assert_raise ArgumentError, ~r/needs a `field` or a `name`/, fn ->
      rendered_to_string(~H"""
      <.select options={["a"]} />
      """)
    end

    assert_raise ArgumentError, ~r/`search` is a function/, fn ->
      rendered_to_string(~H"""
      <.select name="s" search="cities" />
      """)
    end
  end

  describe "color_picker" do
    test "Erabi's nine colors by name, in the page's words, drawn as their chips" do
      assigns = %{form: task_form(%{"color" => "blue"})}

      html =
        rendered_to_string(~H"""
        <.color_picker field={@form[:color]} locale="fr" />
        """)

      config = config(html)
      assert %{"kind" => "color"} = config
      refute config["multiple"]
      assert length(config["options"]) == 9
      assert %{"v" => "blue", "l" => "Bleu", "c" => "blue"} in config["options"]
      refute config["rules"]["create"]
      assert value(html) == ["blue"]
    end

    test "custom takes any color as #rrggbb, which posts with the form" do
      assigns = %{form: task_form(%{"color" => "#3f6f8f"})}

      html =
        rendered_to_string(~H"""
        <.color_picker field={@form[:color]} custom contrast="#ffffff" />
        """)

      config = config(html)
      assert %{"create" => true, "pattern" => "#[0-9a-fA-F]{6}"} = config["rules"]
      assert config["contrast"] == "#ffffff"

      doc = LazyHTML.from_fragment(html)

      assert ["#3f6f8f"] =
               doc |> LazyHTML.query("option[selected]") |> LazyHTML.attribute("value")

      rules = Erabi.Rules.new(create: true, pattern: "#[0-9a-fA-F]{6}")
      assert :ok = Erabi.Rules.check(rules, ["#3f6f8f"], [])
      assert {:error, _} = Erabi.Rules.check(rules, ["teal"], [])
    end

    test "an app's palette, as options" do
      assigns = %{}

      html =
        rendered_to_string(~H"""
        <.color_picker name="color" value="#3f6f8f" palette={[{"Ocean", "#3f6f8f"}, {"Sand", "#d8c3a5"}]} />
        """)

      assert [%{"v" => "#3f6f8f", "l" => "Ocean"}, %{"v" => "#d8c3a5", "l" => "Sand"}] =
               config(html)["options"]
    end
  end
end
