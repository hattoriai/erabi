# LazyHTML is a dependency of an app's tests (Phoenix.LiveViewTest needs
# it), not of Erabi: Erabi.Test calls it, and it is not in the PLT.
[
  {"lib/erabi/test.ex", :unknown_function}
]
