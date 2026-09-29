import { getT } from "@/lib/i18n/server";
import { dateTimeIn } from "@/lib/dates";

/**
 * The heading a printed report carries (release AA): the café, the report,
 * its dates, and when its figures were read. Shown only on paper.
 */
export async function PrintHead({
  business,
  title,
  period,
  timezone,
}: {
  business: string;
  title: string;
  period?: string;
  timezone: string;
}) {
  const t = await getT();
  return (
    <div className="print-only print-head" data-testid="print-head">
      <b>{business}</b> · {title}
      {period ? ` · ${period}` : ""} ·{" "}
      {t("As of {when}", { when: dateTimeIn(timezone, new Date().toISOString()) })}
    </div>
  );
}
