import { describe, expect, it } from "vitest";
import { TOURS, TOUR_PHRASES, tourFor } from "@/lib/tours";
import { builtInWords } from "@/lib/i18n/dictionaries";

describe("show me around (round six)", () => {
  it("a tour for the till, Production and the dashboard, and none elsewhere", () => {
    expect(TOURS.map((t) => [t.key, t.path])).toEqual([
      ["pos", "/pos"],
      ["production", "/production"],
      ["dashboard", "/dashboard"],
    ]);
    expect(tourFor("/pos")?.key).toBe("pos");
    expect(tourFor("/reports")).toBeNull();
    expect(tourFor(null)).toBeNull();
  });

  it("each step points somewhere, and says what it is for in a sentence", () => {
    for (const tour of TOURS) {
      expect(tour.steps.length).toBeGreaterThanOrEqual(4);
      for (const s of tour.steps) {
        expect(s.at.length).toBeGreaterThan(0);
        // Each place a CSS selector the browser can read.
        for (const sel of s.at) expect(sel).toMatch(/^[.#[a-z]/);
        expect(s.title.length).toBeGreaterThan(3);
        expect(s.text).toMatch(/[.!?]$/);
      }
    }
  });

  it("every word of the tours in Arabic and in Kurdish", () => {
    for (const locale of ["ar", "ckb"] as const) {
      const words = builtInWords(locale);
      expect(TOUR_PHRASES.filter((p) => !words[p])).toEqual([]);
    }
  });
});
