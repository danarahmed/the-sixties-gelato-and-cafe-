"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { phoneText, type CustomerRow } from "@/lib/customers";
import { fmtIQD } from "@/lib/format";
import { dateTimeIn } from "@/lib/dates";
import { useT } from "@/lib/i18n/I18nProvider";
import { inputStyle } from "@/components/ui";
import { CustomerForm } from "./CustomerForm";

/** Digits only, Arabic-Indic and Persian ones read as theirs: a number searched any way. */
const digits = (s: string) =>
  s
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/\D/g, "");

/**
 * The café's customers (0050): each one's number, points, how many orders
 * they paid and what those came to (voids left out, refunds taken off), and
 * when they last bought. Searched by name or by any part of the number.
 */
export function CustomersList({
  customers,
  timezone,
  canEdit,
}: {
  customers: CustomerRow[];
  timezone: string;
  canEdit: boolean;
}) {
  const { t } = useT();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [adding, setAdding] = useState(false);
  const shown = useMemo(() => {
    const words = q.trim().toLowerCase();
    const n = digits(q);
    if (!words) return customers;
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(words) ||
        (n.length >= 3 && (digits(c.phone).includes(n) || digits(phoneText(c.phone)).includes(n))),
    );
  }, [customers, q]);

  return (
    <div className="grid" style={{ gap: 12 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <input
          style={{ ...inputStyle, flex: "1 1 240px" }}
          value={q}
          placeholder={t("Search by name or number")}
          aria-label={t("Search by name or number")}
          onChange={(e) => setQ(e.target.value)}
          data-testid="customer-search"
        />
        {canEdit && !adding && (
          <button type="button" onClick={() => setAdding(true)} data-testid="add-customer">
            {t("+ Add a customer")}
          </button>
        )}
      </div>
      {adding && (
        <div className="card grid" style={{ gap: 10 }}>
          <b>{t("A new customer")}</b>
          <CustomerForm
            onDone={(c) => {
              setAdding(false);
              router.push(`/customers/${c.customerId}`);
            }}
            onCancel={() => setAdding(false)}
          />
        </div>
      )}
      {customers.length === 0 ? (
        <p className="muted" style={{ margin: 0 }} data-testid="customers-empty">
          {t(
            "No customers yet. They are added at the till, by their phone number, or here; each earns points on what they buy.",
          )}
        </p>
      ) : (
        <div className="tw">
          <table data-testid="customers">
            <thead>
              <tr>
                <th>{t("Name")}</th>
                <th>{t("Phone")}</th>
                <th className="right">{t("Points")}</th>
                <th className="right">{t("Orders")}</th>
                <th className="right">{t("Bought")}</th>
                <th>{t("Last bought")}</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((c) => (
                <tr key={c.id} data-testid="customer-row" data-name={c.name}>
                  <td>
                    <Link href={`/customers/${c.id}`}>{c.name}</Link>{" "}
                    {!c.active && <span className="badge">{t("Put away")}</span>}
                  </td>
                  <td className="mono" dir="ltr">
                    {phoneText(c.phone)}
                  </td>
                  <td className="right mono" data-testid="customer-points">
                    {c.points}
                  </td>
                  <td className="right mono">{c.orders}</td>
                  <td className="right mono">{fmtIQD(c.spent)}</td>
                  <td className="muted">
                    {c.lastOrderAt ? dateTimeIn(timezone, c.lastOrderAt) : "—"}
                  </td>
                </tr>
              ))}
              {shown.length === 0 && (
                <tr>
                  <td colSpan={6} className="muted">
                    {t("Nobody matches that search.")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
