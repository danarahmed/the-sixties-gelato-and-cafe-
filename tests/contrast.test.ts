/**
 * Words the café can read (AM): every colour the screens write words in is
 * at least 4.5 times as light, or as dark, as each background it is written
 * on (WCAG's AA contrast for text), in the light theme and in the dark one.
 * The colours are read from the stylesheet's own tokens, so a new colour or
 * a changed one is checked where it is set.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// The stylesheet, its comments left out.
const css = readFileSync(join(__dirname, "../src/app/globals.css"), "utf8").replace(
  /\/\*[\s\S]*?\*\//g,
  "",
);

/** The tokens every `selector { … }` block sets, in the order they are written. */
function tokens(selector: RegExp): Record<string, string> {
  const out: Record<string, string> = {};
  for (const block of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    // The selector: what follows the last statement before it (an @import).
    if (!selector.test(block[1]!.split(";").pop()!.trim())) continue;
    for (const m of block[2]!.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})\b/g)) out[m[1]!] = m[2]!;
  }
  return out;
}

const LIGHT = tokens(/^:root$/);
const THEMES = { light: LIGHT, dark: { ...LIGHT, ...tokens(/^:root\[data-theme="dark"\]$/) } };

/** The relative luminance of a colour (WCAG 2). */
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

/** Each colour words are written in, and the backgrounds it is written on. */
const WRITTEN: [string[], string[]][] = [
  [
    ["text", "text-muted", "faint", "brand", "accent", "ok", "warn", "err", "info"],
    ["paper", "surface", "surface-2"],
  ],
  [["brand-ink"], ["brand"]],
  [
    ["rail-ink", "rail-mute"],
    ["rail", "rail-2"],
  ],
];

describe("the screens' words", () => {
  it("read the theme's colours from the stylesheet", () => {
    for (const theme of Object.values(THEMES))
      for (const [fgs, bgs] of WRITTEN)
        for (const name of [...fgs, ...bgs]) expect(theme[name], name).toMatch(/^#/);
  });

  it("are at least 4.5 times as light or as dark as what they are written on", () => {
    const short: string[] = [];
    for (const [theme, t] of Object.entries(THEMES))
      for (const [fgs, bgs] of WRITTEN)
        for (const fg of fgs)
          for (const bg of bgs) {
            const ratio = contrast(t[fg]!, t[bg]!);
            if (ratio < 4.5) short.push(`${theme}: ${fg} on ${bg} ${ratio.toFixed(2)}`);
          }
    expect(short).toEqual([]);
  });

  it("keep their order: the text, then the quieter words, then the faintest", () => {
    for (const t of Object.values(THEMES)) {
      const on = (fg: string) => contrast(t[fg]!, t.surface!);
      expect(on("text")).toBeGreaterThan(on("text-muted"));
      expect(on("text-muted")).toBeGreaterThan(on("faint"));
    }
  });

  it("measure contrast as WCAG does", () => {
    expect(contrast("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrast("#ffffff", "#ffffff")).toBe(1);
    expect(contrast("#777777", "#ffffff")).toBeCloseTo(4.48, 2);
  });
});
