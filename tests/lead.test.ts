import { describe, expect, it } from "vitest";
import { splitLead } from "@/lib/i18n/lead";

describe("a page's explanation in one line, the rest folded", () => {
  it("shows the first sentence and folds the rest", () => {
    expect(splitLead("Who works here. Each person clocks in.")).toEqual({
      lead: "Who works here.",
      rest: "Each person clocks in.",
    });
  });
  it("keeps marked words whole: a full stop inside them does not end the sentence", () => {
    expect(splitLead("<b>Blind count.</b> Count the shelf. A manager approves.")).toEqual({
      lead: "<b>Blind count.</b> Count the shelf.",
      rest: "A manager approves.",
    });
  });
  it("does not split a number or a code", () => {
    expect(splitLead("It sits in 1100.5 until paid. Then it is matched.").lead).toBe(
      "It sits in 1100.5 until paid.",
    );
  });
  it("one sentence: nothing to fold", () => {
    expect(splitLead("Choose today or a day before it.")).toEqual({
      lead: "Choose today or a day before it.",
      rest: "",
    });
  });
  it("Arabic and Kurdish end their sentences the same way", () => {
    expect(splitLead("هەموو شاشەیەک بە سێ زمانە. زمانێکی تر زیاد بکە.").lead).toBe(
      "هەموو شاشەیەک بە سێ زمانە.",
    );
    expect(splitLead("ما الخطأ؟ اسحبه وأعد الجرد.").lead).toBe("ما الخطأ؟");
  });
});
