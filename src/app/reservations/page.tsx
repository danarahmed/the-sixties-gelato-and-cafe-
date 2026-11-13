import { redirect } from "next/navigation";
import { PageIntro } from "@/components/PageIntro";
import { Reservations } from "@/components/reservations/Reservations";
import { getT } from "@/lib/i18n/server";
import { requirePart, requirePermission } from "@/lib/auth/session";
import { getReservations, getTablesForBooking } from "@/lib/db/reservations";
import { businessToday } from "@/lib/dates";

export const dynamic = "force-dynamic";

/** Reservations and the waiting list (0110): a day's bookings, and the parties waiting now. */
export default async function ReservationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const profile = await requirePermission("sale.create");
  requirePart(profile, "reservations");
  const [t, sp] = await Promise.all([getT(), searchParams]);
  const today = businessToday(profile.timezone);
  const day = typeof sp.day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.day) ? sp.day : today;
  const [list, tables] = await Promise.all([getReservations(day), getTablesForBooking()]);
  if (!list) redirect("/today");
  return (
    <div className="grid" style={{ gap: 12 }}>
      <div className="phead">
        <h1>{t("Reservations")}</h1>
      </div>
      <PageIntro
        text={t(
          "The day's bookings and the parties waiting now: seat one at a table, or mark it cancelled or not come.",
        )}
        more={t("How this works")}
      />
      <Reservations
        list={list}
        tables={tables}
        day={day}
        today={today}
        timezone={profile.timezone}
      />
    </div>
  );
}
