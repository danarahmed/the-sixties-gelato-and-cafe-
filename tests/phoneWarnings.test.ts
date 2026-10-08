/**
 * Warnings on your phone (0072, round eleven), as the app's address sends
 * them: each in its phone's language, only the app's own pages opened from
 * it, short enough for a phone; a round sends what waits, says what went, and
 * drops the phones the push service says are gone.
 */
import { describe, expect, it } from "vitest";
import {
  PUSH_DB_MESSAGES,
  clip,
  isGone,
  phonePayload,
  pushRound,
  safePath,
  waitingFrom,
  type WaitingMessage,
} from "@/lib/push";
import { builtInWords } from "@/lib/i18n/dictionaries";

const message = (over: Partial<WaitingMessage> = {}): WaitingMessage => ({
  id: 1,
  endpoint: "https://push.example/1",
  p256dh: "k".repeat(87),
  auth: "a".repeat(22),
  locale: "en",
  title: "A test from the café: warnings come to this phone",
  body: "They come within about five minutes of being seen.",
  url: "/account",
  tag: "test",
  urgent: false,
  ...over,
});

describe("what a phone is sent", () => {
  it("is in the phone's language, right to left in Arabic and Kurdish", () => {
    const en = phonePayload(message());
    expect(en).toMatchObject({
      title: "A test from the café: warnings come to this phone",
      dir: "ltr",
      lang: "en",
    });
    const ckb = phonePayload(message({ locale: "ckb" }));
    expect(ckb.title).toBe(
      builtInWords("ckb")["A test from the café: warnings come to this phone"],
    );
    expect(ckb.body).toBe(
      builtInWords("ckb")["They come within about five minutes of being seen."],
    );
    expect(ckb).toMatchObject({ dir: "rtl", lang: "ckb" });
    expect(phonePayload(message({ locale: "fr" })).lang).toBe("en");
  });

  it("reads a summary's count, and each title in its list", () => {
    const p = phonePayload(
      message({
        locale: "ar",
        title: "4 new warnings at the café",
        body: "A test was sent a moment ago: wait a minute; Not allowed",
      }),
    );
    expect(p.title).toBe("4 تنبيهات جديدة في المقهى");
    expect(p.body).toBe("أُرسلت تجربة قبل لحظات: انتظر دقيقة · غير مسموح");
  });

  it("opens only the app's own pages", () => {
    expect(safePath("/sales?x=1")).toBe("/sales?x=1");
    expect(safePath("https://evil.example")).toBe("/dashboard");
    expect(safePath("//evil.example")).toBe("/dashboard");
    expect(safePath(null)).toBe("/dashboard");
  });

  it("is short enough for a phone, cut at a word", () => {
    expect(clip("short", 10)).toBe("short");
    expect(clip("the milk is running out today", 16)).toBe("the milk is…");
    expect(phonePayload(message({ title: "x ".repeat(100) })).title.length).toBeLessThanOrEqual(
      120,
    );
  });

  it("keeps a tag, or makes one, so a phone replaces rather than piles up", () => {
    expect(phonePayload(message({ tag: null, id: 7 })).tag).toBe("m7");
  });
});

describe("a round of sending", () => {
  const waiting = [
    message({ id: 1, endpoint: "https://push.example/ok" }),
    message({ id: 2, endpoint: "https://push.example/gone" }),
    message({ id: 3, endpoint: "https://push.example/busy" }),
  ];

  it("says what went, and which phones are gone; what failed otherwise waits", async () => {
    const told: { sent: number[]; gone: string[] }[] = [];
    const r = await pushRound({
      take: async () => ({
        subject: "https://cafe.example",
        publicKey: "P",
        privateKey: "Q",
        messages: waiting,
      }),
      send: async (m, payload, keys) => {
        expect(keys).toEqual({ subject: "https://cafe.example", publicKey: "P", privateKey: "Q" });
        expect(payload.url).toBe("/account");
        if (m.endpoint.endsWith("/gone"))
          throw Object.assign(new Error("gone"), { statusCode: 410 });
        if (m.endpoint.endsWith("/busy"))
          throw Object.assign(new Error("busy"), { statusCode: 503 });
      },
      done: async (sent, gone) => {
        told.push({ sent, gone });
      },
    });
    expect(r).toEqual({ sent: 1, gone: 1, failed: 1 });
    expect(told).toEqual([{ sent: [1], gone: ["https://push.example/gone"] }]);
  });

  it("tells the database nothing when nothing waits", async () => {
    let told = false;
    const r = await pushRound({
      take: async () => ({ subject: "", publicKey: "", privateKey: "", messages: [] }),
      send: async () => {},
      done: async () => {
        told = true;
      },
    });
    expect(r).toEqual({ sent: 0, gone: 0, failed: 0 });
    expect(told).toBe(false);
  });

  it("reads the database's queue, leaving out what has no https address", () => {
    const q = waitingFrom([
      {
        id: 5,
        endpoint: "https://push.example/5",
        p256dh: "k",
        auth: "a",
        locale: "ckb",
        title: "T",
        urgent: true,
      },
      { id: 6, endpoint: "http://push.example/6", title: "T" },
      null,
      "x",
    ]);
    expect(q).toHaveLength(1);
    expect(q[0]).toMatchObject({
      id: 5,
      locale: "ckb",
      urgent: true,
      body: null,
      url: "/dashboard",
    });
    expect(waitingFrom(null)).toEqual([]);
  });

  it("knows a phone that is gone for good", () => {
    expect([404, 410, 400, 500, undefined].map(isGone)).toEqual([true, true, false, false, false]);
  });
});

describe("the words", () => {
  it("has what the database writes to phones in Arabic and Kurdish", () => {
    for (const locale of ["ar", "ckb"] as const) {
      const words = builtInWords(locale);
      expect(
        PUSH_DB_MESSAGES.filter((p) => !words[p]),
        locale,
      ).toEqual([]);
    }
  });
});
