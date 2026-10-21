import { requirePermission } from "@/lib/auth/session";
import { businessToday, parseDay } from "@/lib/dates";
import { Glance } from "@/components/reports/Glance";
import { ReportVisit } from "@/components/reports/ReportVisit";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The week at a glance (round four): the seven days to a day — today unless
 * another is asked — against the seven before them. The month is a tap away.
 */
export default async function WeekPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const profile = await requirePermission("cost.view");
  const sp = await searchParams;
  const today = businessToday(profile.timezone);
  const asked = parseDay(sp.end, today);
  const location = typeof sp.location === "string" && UUID.test(sp.location) ? sp.location : null;
  return (
    <>
      <ReportVisit path="/reports/week" />
      <Glance
        profile={profile}
        span="week"
        at={asked > today ? today : asked}
        location={location}
      />
    </>
  );
}
