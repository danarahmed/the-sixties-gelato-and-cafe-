/**
 * Reports, each person's most opened first (SMART_PLAN F4, 0091). Nobody
 * arranges them: each report a person opens is counted, and the hub puts
 * those they open most first. A report opened only once or twice moves
 * nothing, so one look does not reshuffle the page.
 */
export const LEARNED_FROM = 3;

/**
 * Sorts the reports in place, the most opened first (from LEARNED_FROM
 * visits), the rest in their own order; true when any moved up.
 */
export function mostOpenedFirst<R extends { path: string }>(
  reports: R[],
  visits: Record<string, number>,
): boolean {
  const n = (r: R) => ((visits[r.path] ?? 0) >= LEARNED_FROM ? (visits[r.path] ?? 0) : 0);
  const order = new Map(reports.map((r, i) => [r, i]));
  const before = reports.map((r) => r.path).join();
  reports.sort((a, b) => n(b) - n(a) || order.get(a)! - order.get(b)!);
  return reports.some((r) => n(r) > 0) && reports.map((r) => r.path).join() !== before;
}
