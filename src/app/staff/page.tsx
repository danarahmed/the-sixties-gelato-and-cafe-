import Link from "next/link";
import { getT } from "@/lib/i18n/server";
import { has, requirePermission } from "@/lib/auth/session";
import { getLocations } from "@/lib/db/read";
import { getAttendance, getLogins, getSchedule, getStaff } from "@/lib/db/staff";
import { weekDays } from "@/lib/staff";
import { addDays, businessToday, dateTimeIn, parseDay } from "@/lib/dates";
import { StaffPeople } from "@/components/staff/StaffPeople";
import { ScheduleWeek } from "@/components/staff/ScheduleWeek";
import { AttendanceList } from "@/components/staff/AttendanceList";
import { ShopClock } from "@/components/staff/ShopClock";
import { getClockScreens, getLinkedPhones, getScreenCheck } from "@/lib/db/clock";
import { Icon } from "@/components/Icon";

export const dynamic = "force-dynamic";

/**
 * Who works here, the schedule and the hours (0049). A manager keeps the
 * people, their PINs and the schedule, and corrects the hours; those who run
 * payroll set the pay. Everyone clocks in and out at the till.
 */
export default async function StaffPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string; place?: string }>;
}) {
  const profile = await requirePermission("staff.manage", "attendance.edit", "payroll.view");
  const t = await getT();
  const timezone = profile.timezone;
  const today = businessToday(timezone);
  const sp = await searchParams;
  const days = weekDays(parseDay(sp.week, today));
  const first = days[0] ?? today;
  const last = days[days.length - 1] ?? today;
  const canManage = has(profile, "staff.manage");
  const canEdit = has(profile, "attendance.edit");
  const canPay = has(profile, "payroll.run");
  const canSetUpClock = has(profile, "settings.manage");
  const seesClock = canManage || canSetUpClock;
  const [people, locations, logins, schedule, lastWeek, hours, screens, here, phones] =
    await Promise.all([
      getStaff(),
      getLocations(),
      canManage ? getLogins() : Promise.resolve([]),
      getSchedule(first, last, null),
      getSchedule(addDays(first, -7), addDays(last, -7), null),
      getAttendance(first, last),
      seesClock ? getClockScreens() : Promise.resolve(null),
      seesClock ? getScreenCheck() : Promise.resolve(null),
      canManage ? getLinkedPhones() : Promise.resolve(null),
    ]);
  const places = locations
    .filter((l) => l.isActive && l.kind !== "warehouse")
    .map((l) => ({ id: l.id, name: l.name }));
  const place = places.find((p) => p.id === sp.place)?.id ?? places[0]?.id ?? "";
  const inNow = people.filter((p) => p.inSince);
  const weekHref = (day: string) => `?week=${day}&place=${place}#schedule`;
  const working = people.filter(
    (p) => p.hiredOn <= last && (p.leftOn === null || p.leftOn >= first),
  );

  return (
    <div className="grid" style={{ gap: 16 }}>
      <h1 style={{ margin: 0 }}>{t("nav.staff")}</h1>
      <p className="muted" style={{ marginTop: 0, fontSize: ".9rem" }}>
        {t(
          "Who works here, the schedule, and the hours. Each person clocks in and out at the till with their name and PIN. Lateness, leaving early, absence and overtime are shown here, and deducted from pay only when a manager says so on Payroll.",
        )}
      </p>

      <section className="card grid" style={{ gap: 8 }} id="in-now" data-testid="in-now">
        <h2 style={{ margin: 0 }}>{t("In now")}</h2>
        {inNow.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            {t("Nobody is clocked in.")}
          </p>
        ) : (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {inNow.map((p) => (
              <span key={p.id} className="badge ok" data-testid="in-now-person">
                {p.name} ·{" "}
                {t("since {time}", { time: dateTimeIn(timezone, p.inSince ?? "").slice(5) })}
              </span>
            ))}
          </div>
        )}
      </section>

      <section className="card grid" style={{ gap: 8 }} id="people">
        <h2 style={{ margin: 0 }}>{t("People")}</h2>
        <StaffPeople
          people={people}
          places={places}
          logins={logins}
          today={today}
          timezone={timezone}
          canManage={canManage}
          canPay={canPay}
          phones={phones}
        />
        {has(profile, "payroll.view") && (
          <p className="muted" style={{ margin: 0, fontSize: ".85rem" }}>
            <Link href="/payroll">{t("Payroll and advances →")}</Link>
          </p>
        )}
      </section>

      {seesClock && (
        <section className="card grid" style={{ gap: 8 }} id="shop-clock">
          <h2 style={{ margin: 0 }}>
            <Icon name="qr" /> {t("The shop's clock")}
          </h2>
          <ShopClock
            screens={screens}
            thisScreen={here?.screen?.id ?? null}
            places={places}
            canSetUp={canSetUpClock}
            timezone={timezone}
          />
        </section>
      )}

      <section className="card grid" style={{ gap: 8 }} id="schedule">
        <h2 style={{ margin: 0 }}>{t("The schedule")}</h2>
        {place ? (
          <ScheduleWeek
            key={`${first}-${place}`}
            schedule={schedule}
            lastWeek={lastWeek}
            days={days}
            locationId={place}
            places={places}
            timezone={timezone}
            canManage={canManage}
            prevHref={weekHref(addDays(first, -7))}
            nextHref={weekHref(addDays(first, 7))}
          />
        ) : (
          <p className="muted" style={{ margin: 0 }}>
            {t("No branch is open yet.")}
          </p>
        )}
      </section>

      <section className="card grid" style={{ gap: 8 }} id="attendance">
        <h2 style={{ margin: 0 }}>{t("The hours, {from} to {to}", { from: first, to: last })}</h2>
        <AttendanceList
          days={hours.days}
          records={hours.records}
          people={working.map((p) => ({ id: p.id, name: p.name }))}
          timezone={timezone}
          canEdit={canEdit}
        />
      </section>
    </div>
  );
}
