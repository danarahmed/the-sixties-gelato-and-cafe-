/**
 * The short videos of the practice tasks (G5), recorded by the browser in a
 * practice café (tests/e2e/videos.e2e.mjs) into public/help/videos/<task>.webm.
 * Each task here has one; its captions are made from the task's own words in
 * each language (src/app/api/captions/[task]/[locale]).
 */
export const VIDEOS: Record<string, { seconds: number }> = {
  open_drawer: { seconds: 9 },
  sell_card: { seconds: 13 },
  sell_cash: { seconds: 12 },
  discount: { seconds: 17 },
  table_bill: { seconds: 15 },
  refund: { seconds: 11 },
  void: { seconds: 8 },
  close_drawer: { seconds: 10 },
  waste: { seconds: 13 },
  batch: { seconds: 9 },
  count: { seconds: 21 },
  approve_count: { seconds: 12 },
  order: { seconds: 17 },
  receive: { seconds: 9 },
  transfer: { seconds: 12 },
  expense: { seconds: 13 },
  price: { seconds: 18 },
  reports: { seconds: 14 },
};

export const videoSrc = (task: string) => `/help/videos/${task}.webm`;
export const captionsSrc = (task: string, locale: string) => `/api/captions/${task}/${locale}`;
