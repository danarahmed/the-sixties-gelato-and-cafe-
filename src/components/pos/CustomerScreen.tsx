"use client";

import { useEffect, useState } from "react";
import { CUSTOMER_SCREEN_CHANNEL, type CustomerScreenMessage } from "@/lib/customerScreen";
import { fmtIQD } from "@/lib/format";
import { useT } from "@/lib/i18n/I18nProvider";

/**
 * The customer's screen: what the till rings up and the total, large; then
 * what was paid and the change; between customers, a welcome.
 */
export function CustomerScreen({ business }: { business: string }) {
  const { t } = useT();
  const [m, setM] = useState<CustomerScreenMessage>({ kind: "idle", business });
  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const ch = new BroadcastChannel(CUSTOMER_SCREEN_CHANNEL);
    ch.onmessage = (e: MessageEvent<CustomerScreenMessage>) => setM(e.data);
    ch.postMessage({ kind: "hello" });
    return () => ch.close();
  }, []);
  return (
    <div
      className="grid"
      style={{ gap: 16, maxWidth: 720, margin: "24px auto", fontSize: "1.25rem" }}
      data-testid="customer-screen"
    >
      <h1 style={{ margin: 0, textAlign: "center" }}>{m.business || business}</h1>
      {m.kind === "idle" && (
        <p style={{ textAlign: "center" }} className="muted">
          {t("Welcome!")}
        </p>
      )}
      {m.kind === "order" && (
        <>
          <table data-testid="customer-screen-lines">
            <tbody>
              {m.lines.map((l, i) => (
                <tr key={i}>
                  <td className="mono">{l.qty}</td>
                  <td dir="auto">{l.name}</td>
                  <td className="right money">{l.amount !== null ? fmtIQD(l.amount) : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: "2rem",
              fontWeight: 700,
            }}
            data-testid="customer-screen-total"
          >
            <span>{t("pos.total")}</span>
            <span className="money">{fmtIQD(m.total)}</span>
          </div>
        </>
      )}
      {m.kind === "paid" && (
        <div
          className="grid"
          style={{ gap: 8, textAlign: "center" }}
          data-testid="customer-screen-paid"
        >
          <div style={{ fontSize: "2rem", fontWeight: 700 }}>{t("Thank you!")}</div>
          <div>{t("Paid {amount}", { amount: fmtIQD(m.total) })}</div>
          {m.change !== null && m.change > 0 && (
            <div style={{ fontSize: "1.6rem" }}>
              {t("Your change: {amount}", { amount: fmtIQD(m.change) })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
