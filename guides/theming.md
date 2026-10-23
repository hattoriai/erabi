# Theming

Every color, space, radius and font of the pickers comes from an
`--erabi-*` custom property. The defaults have no specificity, so a value
set on `:root`, on an ancestor or on `.erabi` itself wins:

```css
:root {
  --erabi-accent: #0f766e;
  --erabi-radius: 4px;
  --erabi-row-height: 2rem;
}
```

The defaults are Kotoba's, Koyomi's and Jumon's own, so that a page with
them looks like one thing.

## The properties

| | |
| --- | --- |
| Type | `--erabi-font`, `--erabi-font-size`, `--erabi-small`, `--erabi-line-height` |
| Colors | `--erabi-text`, `--erabi-muted`, `--erabi-background`, `--erabi-surface`, `--erabi-border`, `--erabi-border-hover`, `--erabi-accent`, `--erabi-accent-text`, `--erabi-invalid`, `--erabi-active`, `--erabi-match` |
| Shape | `--erabi-radius`, `--erabi-inner-radius`, `--erabi-chip-radius`, `--erabi-field-height`, `--erabi-row-height`, `--erabi-space`, `--erabi-icon-size`, `--erabi-avatar-size`, `--erabi-agent-radius` |
| Depth and motion | `--erabi-shadow`, `--erabi-transition`, `--erabi-focus-ring` |
| The palette | `--erabi-{color}-surface` and `--erabi-{color}-text` for gray, brown, orange, yellow, green, blue, purple, pink and red |

`--erabi-row-height` is the height of every row of a list: a long list
draws only the rows on screen, by that height.

## Dark

The defaults are light, and dark under `data-theme="dark"` (the
attribute of Phoenix's themes) or the class `dark`. Each color of the
palette has its dark pair.

## The palette

A palette color of your own keeps the contrast of its pair: the chip's
text on its surface at 4.5:1 at least (the built-in pairs are 6.8:1 and
more).

## Sumi

`erabi-sumi.css`, after `erabi.css`, maps every property to the Sumi
tokens of the page (its daisyUI themes, or the short `--sumi-*` names),
or to Sumi's own palette when the page has none.

## Touch

On a coarse pointer, fields and rows are taller (2.75rem). On a phone,
popups are sheets from the bottom of the screen (`.erabi-sheet`, its
head `.erabi-sheet-head`, its dimmed page `.erabi-sheet::backdrop`); see
the Pickers guide.

## Classes

`.erabi` (and `.erabi-select`, `.erabi-multi_select`, ...), `.erabi-field`,
`.erabi-chip` (`data-color`), `.erabi-avatar` (`data-kind`), `.erabi-popup`,
`.erabi-list`, `.erabi-option` (`.erabi-active`, `aria-selected`),
`.erabi-heading`, `.erabi-hint`, `.erabi-badge`, `.erabi-match`.
