/**
 * The short videos of the practice tasks (G5), recorded by the browser in a
 * practice café (tests/e2e/videos.e2e.mjs) into public/help/videos/<task>.webm.
 * Each task here has one; its captions are made from the task's own words in
 * each language (src/app/api/captions/[task]/[locale]).
 */
export const VIDEOS: Record<string, { seconds: number }> = {};

export const videoSrc = (task: string) => `/help/videos/${task}.webm`;
export const captionsSrc = (task: string, locale: string) => `/api/captions/${task}/${locale}`;
