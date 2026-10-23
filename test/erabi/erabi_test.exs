defmodule ErabiTest do
  use ExUnit.Case, async: true

  test "a picker as a grid's cell editor: its name and options" do
    assert {"erabi_multi_select", options} =
             Erabi.cell_editor(:multi_select,
               options: [%{value: "bug", label: "Bug", color: :red}],
               max: 3,
               locale: "pt"
             )

    assert options["options"] == [%{"v" => "bug", "l" => "Bug", "c" => "red"}]
    assert options["rules"] == %{"max" => 3}
    assert options["messages"]["clear"] == "Limpar"
    refute Map.has_key?(options, "me")

    assert {"erabi_person", %{"me" => "7", "multiple" => true}} =
             Erabi.cell_editor(:person, options: [%{id: 7, name: "Ada"}], me: 7, multiple: true)
  end
end
