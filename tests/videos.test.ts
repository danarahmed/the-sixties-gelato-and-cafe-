import { describe, expect, it } from "vitest";
import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { PRACTICE_TASKS } from "@/lib/practice";
import { VIDEOS, captionsSrc, videoSrc } from "@/lib/help/videos";
import { phrasesIn } from "@/lib/i18n/phrases";
import { GET } from "@/app/api/captions/[task]/[locale]/route";

/** The captions the route makes for a task, in a language. */
async function captions(task: string, locale: string) {
  const res = await GET(new Request(`http://localhost${captionsSrc(task, locale)}`), {
    params: Promise.resolve({ task, locale }),
  });
  return { status: res.status, type: res.headers.get("content-type"), text: await res.text() };
}

describe("the practice tasks' videos", () => {
  it("are of practice tasks, each with its file and how long it plays", () => {
    const tasks = Object.keys(VIDEOS);
    expect(tasks.length).toBeGreaterThan(10);
    expect(tasks.filter((t) => !(t in PRACTICE_TASKS))).toEqual([]);
    for (const task of tasks) {
      const file = join("public", videoSrc(task));
      expect(existsSync(file), file).toBe(true);
      expect(statSync(file).size, file).toBeLessThan(1024 * 1024);
      expect(Number.isInteger(VIDEOS[task]!.seconds)).toBe(true);
      expect(VIDEOS[task]!.seconds).toBeGreaterThan(4);
    }
  });

  it("are captioned with the task's title, then how it is done", async () => {
    const task = "sell_card";
    const info = PRACTICE_TASKS[task]!;
    const end = `00:00:${String(VIDEOS[task]!.seconds).padStart(2, "0")}.000`;

    const en = await captions(task, "en");
    expect(en.status).toBe(200);
    expect(en.type).toMatch(/^text\/vtt/);
    expect(en.text).toBe(
      [
        "WEBVTT",
        "",
        `1\n00:00:00.000 --> 00:00:04.000\n${info.title}`,
        "",
        `2\n00:00:04.000 --> ${end}\n${info.how}`,
        "",
      ].join("\n"),
    );

    const ckb = await captions(task, "ckb");
    const words = phrasesIn("ckb");
    expect(ckb.status).toBe(200);
    expect(ckb.text).toContain(words[info.title]!.replace(/\n/g, " "));
    expect(ckb.text).toContain(words[info.how]!.replace(/\n/g, " "));
    expect(ckb.text).not.toContain(info.title);
    // Kurdish in its own letters: none of Arabic's ك ي ة ى.
    expect(ckb.text).not.toMatch(/[كيةى]/);
  });

  it("has no captions for a task with no video", async () => {
    expect((await captions("no_such_task", "en")).status).toBe(404);
  });
});
