import { requirePermission } from "@/lib/auth/session";
import { businessToday, parseDay } from "@/lib/dates";
import { Glance } from "@/components/reports/Glance";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The month at a glance (round five): a month — this one unless another is
 * asked as ?month=2026-09 — to today while it runs, against the same days of
 * the month before, and all of it once it is over. The week is a tap away.
 */
export default async function MonthPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const profile = await requirePermission("cost.view");
  const sp = await searchParams;
  const today = businessToday(profile.timezone);
  const month = typeof sp.month === "string" ? sp.month : undefined;
  const asked = parseDay(month && /^\d{4}-\d{2}$/.test(month) ? `${month}-01` : undefined, today);
  const location = typeof sp.location === "string" && UUID.test(sp.location) ? sp.location : null;
  return (
    <Glance profile={profile} span="month" at={asked > today ? today : asked} location={location} />
  );
}
