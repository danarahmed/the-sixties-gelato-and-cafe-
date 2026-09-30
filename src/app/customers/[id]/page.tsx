import Link from "next/link";
import { notFound } from "next/navigation";
import { getT } from "@/lib/i18n/server";
import { has, requirePermission } from "@/lib/auth/session";
import { getCustomer } from "@/lib/db/customers";
import { LOYALTY_KIND_LABEL } from "@/lib/customers";
import { getChannelNames } from "@/lib/db/channels";
import { fmtIQD, orderStatusLabel } from "@/lib/format";
import { dateIn, dateTimeIn } from "@/lib/dates";
import { CustomerPanel } from "@/components/customers/CustomerPanel";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A customer: their details and addresses, what they bought, and how their points moved (0050). */
export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await requirePermission("customer.view");
  const t = await getT();
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const [customer, channels] = await Promise.all([getCustomer(id), getChannelNames()]);
  if (!customer) notFound();
  const tz = profile.timezone;

  return (
    <div className="grid" style={{ gap: 16 }}>
      <Link href="/customers" className="muted">
        {t("← All customers")}
      </Link>
      <CustomerPanel
        customer={customer}
        timezone={tz}
        canEdit={has(profile, "customer.edit")}
        canAdjust={has(profile, "loyalty.adjust")}
      />

      <section className="card grid" style={{ gap: 8 }} id="orders">
        <h2 style={{ margin: 0 }}>{t("What they bought")}</h2>
        {customer.orders.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            {t("Nothing yet.")}
          </p>
        ) : (
          <div className="tw">
            <table data-testid="customer-orders">
              <thead>
                <tr>
                  <th>{t("When")}</th>
                  <th>{t("pos.channel")}</th>
                  <th>{t("Status")}</th>
                  <th className="right">{t("Paid")}</th>
                  <th className="right">{t("Given back")}</th>
                  <th className="right">{t("Points")}</th>
                </tr>
              </thead>
              <tbody>
                {customer.orders.map((o) => {
                  const day = dateIn(tz, new Date(o.placedAt));
                  return (
                    <tr key={o.orderId} data-testid="customer-order" data-status={o.status}>
                      <td>
                        <Link href={`/orders?from=${day}&to=${day}`}>
                          {dateTimeIn(tz, o.placedAt)}
                        </Link>
                        {o.deliveryAddress && (
                          <div className="muted" style={{ fontSize: ".8rem" }}>
                            {t("Delivered to {address}", { address: o.deliveryAddress })}
                          </div>
                        )}
                      </td>
                      <td>{channels.name(o.channel)}</td>
                      <td>{t(orderStatusLabel(o.status))}</td>
                      <td className="right mono">{fmtIQD(o.net)}</td>
                      <td className="right mono">{o.refunded > 0 ? fmtIQD(o.refunded) : "—"}</td>
                      <td className="right mono">
                        {o.earned > 0 ? `+${o.earned}` : ""}
                        {o.spent > 0 ? ` −${o.spent}` : ""}
                        {o.earned === 0 && o.spent === 0 ? "—" : ""}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card grid" style={{ gap: 8 }} id="ledger">
        <h2 style={{ margin: 0 }}>{t("How their points moved")}</h2>
        {customer.ledger.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            {t("No points yet.")}
          </p>
        ) : (
          <div className="tw">
            <table data-testid="customer-ledger">
              <thead>
                <tr>
                  <th>{t("When")}</th>
                  <th>{t("What")}</th>
                  <th className="right">{t("Points")}</th>
                  <th>{t("Why")}</th>
                  <th>{t("By")}</th>
                </tr>
              </thead>
              <tbody>
                {customer.ledger.map((l) => (
                  <tr key={l.id} data-testid="ledger-row" data-kind={l.kind}>
                    <td className="when">{dateTimeIn(tz, l.at)}</td>
                    <td>
                      {t(LOYALTY_KIND_LABEL[l.kind])}
                      {l.kind === "redeem" && l.value !== null && (
                        <span className="muted">
                          {" "}
                          · {t("{amount} off", { amount: fmtIQD(l.value) })}
                        </span>
                      )}
                      {l.refundNo !== null && (
                        <span className="muted">
                          {" "}
                          · {t("Refund {no}", { no: String(l.refundNo) })}
                        </span>
                      )}
                    </td>
                    <td className="right mono">
                      {l.points > 0 ? `+${l.points}` : String(l.points)}
                    </td>
                    <td>{l.reason ?? "—"}</td>
                    <td className="muted">{l.by ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
