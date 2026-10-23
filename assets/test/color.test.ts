import assert from "node:assert/strict";
import { test } from "node:test";
import { clampChroma, contrast, hexToRgb, inGamut, maxChroma, normalizeHex, oklchToRgb, rgbToHex, rgbToOklch } from "../src/color";

test("hex: #rgb and #rrggbb, with or without #, as #rrggbb; anything else is none", () => {
  assert.equal(normalizeHex("#ABC"), "#aabbcc");
  assert.equal(normalizeHex("3f6f8f"), "#3f6f8f");
  assert.equal(normalizeHex("  #3F6F8F "), "#3f6f8f");
  assert.equal(normalizeHex("teal"), null);
  assert.equal(normalizeHex("#12345"), null);
  assert.equal(rgbToHex(hexToRgb("#3f6f8f")), "#3f6f8f");
});

test("OKLCH of sRGB, and back, as the CSS spec's examples", () => {
  const white = rgbToOklch([1, 1, 1]);
  assert.ok(Math.abs(white.l - 1) < 1e-3 && white.c < 1e-3);
  // oklch(0.628 0.2577 29.23) is sRGB red.
  const red = rgbToOklch([1, 0, 0]);
  assert.ok(Math.abs(red.l - 0.628) < 2e-3 && Math.abs(red.c - 0.2577) < 2e-3 && Math.abs(red.h - 29.23) < 0.2);
  for (const hex of ["#000000", "#3f6f8f", "#e84a1c", "#ffffff", "#00ff00"]) {
    assert.equal(rgbToHex(oklchToRgb(rgbToOklch(hexToRgb(hex)))), hex);
  }
});

test("chroma is cut to what a screen shows, at the color's lightness and hue", () => {
  const vivid = { l: 0.7, c: 0.4, h: 250 };
  assert.equal(inGamut(oklchToRgb(vivid)), false);
  const shown = clampChroma(vivid);
  assert.ok(inGamut(oklchToRgb(shown)) && shown.c > 0.1 && shown.c < 0.4);
  assert.equal(shown.l, 0.7);
  assert.ok(Math.abs(maxChroma(0.7, 250) - shown.c) < 1e-6);
  assert.ok(maxChroma(1, 250) < 1e-3, "white has no chroma");
});

test("contrast as WCAG says it", () => {
  assert.equal(contrast([0, 0, 0], [1, 1, 1]), 21);
  assert.equal(contrast([1, 1, 1], [1, 1, 1]), 1);
  // #767676 is the lightest gray with 4.5:1 on white.
  assert.ok(contrast(hexToRgb("#767676"), [1, 1, 1]) >= 4.5);
  assert.ok(contrast(hexToRgb("#777777"), [1, 1, 1]) < 4.5);
});
