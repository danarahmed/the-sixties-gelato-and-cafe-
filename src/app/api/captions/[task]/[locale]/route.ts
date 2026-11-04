import { PRACTICE_TASKS } from "@/lib/practice";
import { VIDEOS } from "@/lib/help/videos";
import { phrasesIn } from "@/lib/i18n/phrases";

/**
 * A practice task's video captions (G5), in WebVTT: its title, then how it is
 * done, in the language asked for. Made from the same words the Practice page
 * shows, so they never drift from it.
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ task: string; locale: string }> },
) {
  const { task, locale } = await ctx.params;
  const info = PRACTICE_TASKS[task];
  const video = VIDEOS[task];
  if (!info || !video) return new Response("Not found", { status: 404 });
  const words = phrasesIn(locale);
  const say = (s: string) => (words[s] ?? s).replace(/\n/g, " ");
  const at = (s: number) =>
    `00:${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}.000`;
  const split = Math.min(4, Math.max(1, video.seconds - 1));
  const body = [
    "WEBVTT",
    "",
    `1\n${at(0)} --> ${at(split)}\n${say(info.title)}`,
    "",
    `2\n${at(split)} --> ${at(video.seconds)}\n${say(info.how)}`,
    "",
  ].join("\n");
  return new Response(body, {
    headers: { "content-type": "text/vtt; charset=utf-8", "cache-control": "public, max-age=3600" },
  });
}
