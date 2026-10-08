import { NextResponse } from "next/server";
import type { Permission } from "@domain/auth/permissions.js";
import { getSession, has } from "@/lib/auth/session";
import { getStaff } from "@/lib/db/staff";
import { getLinkedPhones } from "@/lib/db/clock";
import { getT } from "@/lib/i18n/server";
import { businessToday } from "@/lib/dates";
import { staffCsv, staffCsvName } from "@/lib/staffCsv";

export const dynamic = "force-dynamic";

/**
 * Staff → Download CSV: the people who work here as a spreadsheet. Runs as the
 * signed-in person, so the database gives the file what it gives the screen:
 * pay only to those who see payroll, linked phones only to those who manage
 * the staff.
 */
export async function GET() {
  const s = await getSession();
  if (!s.profile) return NextResponse.json({ error: "Sign in to continue" }, { status: 401 });
  const profile = s.profile;
  const may: Permission[] = ["staff.manage", "attendance.edit", "payroll.view"];
  if (!may.some((p) => has(profile, p)))
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  try {
    const [people, phones, t] = await Promise.all([
      getStaff(),
      has(profile, "staff.manage") ? getLinkedPhones() : Promise.resolve(null),
      getT(),
    ]);
    const body = staffCsv(people, {
      t,
      timezone: profile.timezone,
      seesPay: has(profile, "payroll.view") && people.some((p) => p.pay !== null),
      phones,
    });
    return new NextResponse(body, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${staffCsvName(businessToday(profile.timezone))}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not make the file" },
      { status: 500 },
    );
  }
}
