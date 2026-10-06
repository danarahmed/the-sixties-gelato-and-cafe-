import { describe, expect, it } from "vitest";
import {
  CLOCK_ANSWERS,
  NO_SCREENS,
  clockScreensFrom,
  clockUrl,
  isKey,
  linkUrl,
  linkedPhonesFrom,
  phoneClockAnswerFrom,
  phoneStatusFrom,
  readCode,
  screenCheckFrom,
  secondsLeft,
  shopCodeFrom,
  spacedCode,
} from "@/lib/clock";
import { isPublicPath } from "@/lib/auth/routes";
import { builtInWords } from "@/lib/i18n/dictionaries";

describe("clocking in on your own phone, with the shop's code (round eight)", () => {
  it("a code as it is typed: 6 digits in any script, spaces and a dash let through", () => {
    expect(readCode("482913")).toBe("482913");
    expect(readCode(" 482 913 ")).toBe("482913");
    expect(readCode("482-913")).toBe("482913");
    expect(readCode("٤٨٢٩١٣")).toBe("482913");
    expect(readCode("۴۸۲۹۱۳")).toBe("482913");
    expect(readCode("48291")).toBeNull();
    expect(readCode("4829134")).toBeNull();
    expect(readCode("48a913")).toBeNull();
    expect(readCode(null)).toBeNull();
  });

  it("a code shown across a room, in two halves", () => {
    expect(spacedCode("482913")).toBe("482 913");
    expect(spacedCode("48")).toBe("48");
  });

  it("the square on a screen opens the phone's clock with the code; Staff's square, the link", () => {
    expect(clockUrl("https://cafe.example", "482913")).toBe("https://cafe.example/clock?c=482913");
    expect(clockUrl("https://cafe.example/", "482913")).toBe("https://cafe.example/clock?c=482913");
    const key = "a".repeat(48);
    expect(linkUrl("https://cafe.example", key)).toBe(`https://cafe.example/clock/link?k=${key}`);
  });

  it("the phone's pages open without signing in: the phone is known by its key", () => {
    expect(isPublicPath("/clock")).toBe(true);
    expect(isPublicPath("/clock/link")).toBe(true);
    expect(isPublicPath("/clock/screen")).toBe(true);
    expect(isPublicPath("/clocks")).toBe(false);
    expect(isPublicPath("/staff")).toBe(false);
  });

  it("a key as the database gives one out, and nothing else", () => {
    expect(isKey("0123456789abcdef".repeat(3))).toBe(true);
    expect(isKey("0123456789ABCDEF".repeat(3))).toBe(false);
    expect(isKey("abc")).toBe(false);
    expect(isKey(null)).toBe(false);
  });

  it("seconds left by the server's clock, never below zero", () => {
    const now = Date.parse("2026-10-06T10:00:10Z");
    expect(secondsLeft("2026-10-06T10:00:30Z", now)).toBe(20);
    expect(secondsLeft("2026-10-06T10:00:10.200Z", now)).toBe(1);
    expect(secondsLeft("2026-10-06T10:00:00Z", now)).toBe(0);
    expect(secondsLeft("not a time", now)).toBe(0);
  });

  it("what the database answers, read", () => {
    expect(
      screenCheckFrom({
        in_use: true,
        screen: { id: "s1", name: "The till", location_id: "l1", location: "Main" },
      }),
    ).toEqual({
      ready: true,
      inUse: true,
      screen: { id: "s1", name: "The till", location: "Main" },
    });
    expect(screenCheckFrom({ in_use: false, screen: null })).toEqual({
      ready: true,
      inUse: false,
      screen: null,
    });
    expect(NO_SCREENS).toEqual({ ready: false, inUse: false, screen: null });

    const now = Date.parse("2026-10-06T10:00:10Z");
    expect(
      shopCodeFrom(
        {
          ok: true,
          code: "482913",
          until: "2026-10-06T10:00:30Z",
          name: "The till",
          location: "Main",
        },
        now,
      ),
    ).toEqual({
      ok: true,
      code: "482913",
      until: "2026-10-06T10:00:30Z",
      left: 20,
      name: "The till",
      location: "Main",
    });
    expect(
      shopCodeFrom({ ok: false, error: "This device is not one of the shop's clock screens" }, now),
    ).toEqual({
      ok: false,
      error: "This device is not one of the shop's clock screens",
    });

    expect(phoneStatusFrom({ linked: false })).toEqual({ linked: false });
    expect(
      phoneStatusFrom({
        linked: true,
        name: "Rana",
        title: "Barista",
        works: true,
        in_since: null,
        in_at: null,
        business: "The Sixty's",
        timezone: "Asia/Baghdad",
      }),
    ).toEqual({
      linked: true,
      name: "Rana",
      title: "Barista",
      works: true,
      inSince: null,
      inAt: null,
      business: "The Sixty's",
      timezone: "Asia/Baghdad",
    });

    expect(
      clockScreensFrom([
        {
          id: "s1",
          name: "The till",
          location_id: "l1",
          location: "Main",
          created_at: "2026-10-06T08:00:00Z",
          created_by: "Owner",
          last_seen_at: null,
        },
      ]),
    ).toEqual([
      {
        id: "s1",
        name: "The till",
        locationId: "l1",
        location: "Main",
        createdAt: "2026-10-06T08:00:00Z",
        createdBy: "Owner",
        lastSeenAt: null,
      },
    ]);
    expect(
      linkedPhonesFrom([
        { employee_id: "e1", linked_at: "2026-10-06T08:00:00Z", last_used_at: null },
      ]),
    ).toEqual({ e1: { linkedAt: "2026-10-06T08:00:00Z", lastUsedAt: null } });
    expect(linkedPhonesFrom(null)).toEqual({});

    expect(
      phoneClockAnswerFrom({
        ok: true,
        name: "Rana",
        clock_in: "2026-10-06T08:02:00Z",
        late_minutes: 2,
        location: "Main",
      }),
    ).toMatchObject({ ok: true, name: "Rana", lateMinutes: 2, location: "Main", error: null });
    expect(
      phoneClockAnswerFrom({
        ok: false,
        error: "That code has changed: scan the shop's code again",
      }),
    ).toMatchObject({ ok: false, error: "That code has changed: scan the shop's code again" });
  });

  it("every answer a phone or a screen may be given, in Arabic and in Kurdish", () => {
    for (const locale of ["ar", "ckb"] as const) {
      const book = builtInWords(locale);
      expect(CLOCK_ANSWERS.filter((w) => !book[w])).toEqual([]);
    }
  });
});
