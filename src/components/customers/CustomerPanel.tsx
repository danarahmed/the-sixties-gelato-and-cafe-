"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  adjustPointsAction,
  saveCustomerAction,
  saveCustomerAddressAction,
} from "@/lib/actions/customers";
import { addressText, phoneText, type CustomerAddress, type CustomerDetail } from "@/lib/customers";
import { dateTimeIn } from "@/lib/dates";
import { useT } from "@/lib/i18n/I18nProvider";
import { Field, Notice, inputStyle } from "@/components/ui";
import { OperationStatus, useOperation } from "@/components/useOperation";
import { CustomerForm } from "./CustomerForm";

type Msg = { ok: boolean; text: string } | null;

/**
 * A customer's details, their addresses and their points (0050). Those who
 * take orders change the details and addresses, and put a customer away (or
 * bring them back); a manager gives or takes points by hand, with why.
 */
export function CustomerPanel({
  customer,
  timezone,
  canEdit,
  canAdjust,
}: {
  customer: CustomerDetail;
  timezone: string;
  canEdit: boolean;
  canAdjust: boolean;
}) {
  const { t } = useT();
  const router = useRouter();
  const op = useOperation();
  const [busy, start] = useTransition();
  const [editing, setEditing] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);

  function putAway(active: boolean) {
    setMsg(null);
    start(async () => {
      const r = await op.run("saveCustomer", (key) =>
        saveCustomerAction(
          {
            customerId: customer.id,
            name: customer.name,
            phone: customer.phone,
            notes: customer.notes,
            active,
          },
          key,
        ),
      );
      if (!r.ok) {
        setMsg({ ok: false, text: r.error });
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="grid" style={{ gap: 16 }}>
      <section className="card grid" style={{ gap: 8 }} data-testid="customer-card">
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "baseline" }}>
          <strong style={{ fontSize: "1.2rem" }}>{customer.name}</strong>
          <span className="mono" dir="ltr">
            {phoneText(customer.phone)}
          </span>
          {!customer.active && <span className="badge">{t("Put away")}</span>}
          <span className="badge ok" data-testid="customer-balance">
            {t("{n} points", { n: String(customer.points) })}
          </span>
        </div>
        {customer.notes && <p style={{ margin: 0 }}>{customer.notes}</p>}
        <p className="muted" style={{ margin: 0, fontSize: ".85rem" }}>
          {t("Added {at} by {name}.", {
            at: dateTimeIn(timezone, customer.createdAt),
            name: customer.createdBy ?? "—",
          })}
        </p>
        {canEdit &&
          (editing ? (
            <CustomerForm
              customer={customer}
              onDone={() => {
                setEditing(false);
                router.refresh();
              }}
              onCancel={() => setEditing(false)}
            />
          ) : (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button type="button" onClick={() => setEditing(true)} data-testid="edit-customer">
                {t("Change their details")}
              </button>
              {customer.active ? (
                <button type="button" disabled={busy} onClick={() => putAway(false)}>
                  {t("Put them away")}
                </button>
              ) : (
                <button type="button" disabled={busy} onClick={() => putAway(true)}>
                  {t("Bring back")}
                </button>
              )}
            </div>
          ))}
        <OperationStatus op={op} />
        <Notice msg={msg} />
      </section>

      <section className="card grid" style={{ gap: 8 }} id="addresses">
        <h2 style={{ margin: 0 }}>{t("Addresses")}</h2>
        <p className="muted" style={{ margin: 0, fontSize: ".85rem" }}>
          {t(
            "Where the café's own driver takes their orders. An address put away stays on the orders delivered to it.",
          )}
        </p>
        <Addresses customerId={customer.id} addresses={customer.addresses} canEdit={canEdit} />
      </section>

      {canAdjust && (
        <section className="card grid" style={{ gap: 8 }} id="points">
          <h2 style={{ margin: 0 }}>{t("Give or take points")}</h2>
          <PointsForm customerId={customer.id} />
        </section>
      )}
    </div>
  );
}

function Addresses({
  customerId,
  addresses,
  canEdit,
}: {
  customerId: string;
  addresses: CustomerAddress[];
  canEdit: boolean;
}) {
  const { t } = useT();
  const [open, setOpen] = useState<string | "new" | null>(null);
  return (
    <div className="grid" style={{ gap: 8 }}>
      {addresses.length === 0 ? (
        <p className="muted" style={{ margin: 0 }}>
          {t("No address yet.")}
        </p>
      ) : (
        <ul style={{ margin: 0, paddingInlineStart: 18 }} data-testid="customer-addresses">
          {addresses.map((a) => (
            <li key={a.id} style={{ marginBottom: 6 }} data-testid="customer-address">
              {a.label && <b>{a.label}: </b>}
              {addressText(a)} {!a.active && <span className="badge">{t("Put away")}</span>}{" "}
              {canEdit && a.active && open !== a.id && (
                <button type="button" className="linklike" onClick={() => setOpen(a.id)}>
                  {t("Change")}
                </button>
              )}
              {open === a.id && (
                <AddressForm
                  customerId={customerId}
                  address={a}
                  onDone={() => setOpen(null)}
                  onCancel={() => setOpen(null)}
                />
              )}
            </li>
          ))}
        </ul>
      )}
      {canEdit &&
        (open === "new" ? (
          <AddressForm
            customerId={customerId}
            onDone={() => setOpen(null)}
            onCancel={() => setOpen(null)}
          />
        ) : (
          <button
            type="button"
            style={{ alignSelf: "start" }}
            onClick={() => setOpen("new")}
            data-testid="add-address"
          >
            {t("+ Add an address")}
          </button>
        ))}
    </div>
  );
}

/** An address added or changed, or put away. */
export function AddressForm({
  customerId,
  address,
  onDone,
  onCancel,
  atTill = false,
}: {
  customerId: string;
  address?: CustomerAddress;
  onDone: (addressId: string) => void;
  onCancel: () => void;
  /** At the till, which keeps itself current: the page is not read again. */
  atTill?: boolean;
}) {
  const { t } = useT();
  const router = useRouter();
  const op = useOperation();
  const [busy, start] = useTransition();
  const [label, setLabel] = useState(address?.label ?? "");
  const [text, setText] = useState(address?.address ?? "");
  const [directions, setDirections] = useState(address?.directions ?? "");
  const [msg, setMsg] = useState<Msg>(null);

  function save(active: boolean) {
    setMsg(null);
    start(async () => {
      const r = await op.run("saveCustomerAddress", (key) =>
        saveCustomerAddressAction(
          {
            customerId,
            addressId: address?.id ?? null,
            label,
            address: text,
            directions,
            active,
          },
          key,
        ),
      );
      if (!r.ok) {
        setMsg({ ok: false, text: r.error });
        return;
      }
      if (!atTill) router.refresh();
      onDone(r.data.addressId);
    });
  }

  return (
    <div className="grid" style={{ gap: 8 }} data-testid="address-form">
      <div
        style={{
          display: "grid",
          gap: 8,
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
        }}
      >
        <Field label={t("Name for it")}>
          <input
            style={inputStyle}
            value={label}
            maxLength={40}
            placeholder={t("Home, work")}
            onChange={(e) => setLabel(e.target.value)}
          />
        </Field>
        <Field label={t("Address")}>
          <input
            style={inputStyle}
            value={text}
            maxLength={300}
            onChange={(e) => setText(e.target.value)}
          />
        </Field>
        <Field label={t("How to find it")}>
          <input
            style={inputStyle}
            value={directions}
            maxLength={300}
            placeholder={t("Near the mosque, second floor")}
            onChange={(e) => setDirections(e.target.value)}
          />
        </Field>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button
          type="button"
          className="btn-primary"
          disabled={busy || !text.trim()}
          onClick={() => save(true)}
        >
          {address ? t("Save") : t("Add the address")}
        </button>
        {address && (
          <button type="button" disabled={busy} onClick={() => save(false)}>
            {t("Put it away")}
          </button>
        )}
        <button type="button" onClick={onCancel} disabled={busy}>
          {t("Cancel")}
        </button>
      </div>
      <OperationStatus op={op} />
      <Notice msg={msg} />
    </div>
  );
}

function PointsForm({ customerId }: { customerId: string }) {
  const { t } = useT();
  const router = useRouter();
  const op = useOperation();
  const [busy, start] = useTransition();
  const [points, setPoints] = useState("");
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState<Msg>(null);

  function save() {
    setMsg(null);
    start(async () => {
      const r = await op.run("adjustPoints", (key) =>
        adjustPointsAction({ customerId, points, reason }, key),
      );
      if (!r.ok) {
        setMsg({ ok: false, text: r.error });
        return;
      }
      setPoints("");
      setReason("");
      setMsg({ ok: true, text: t("Done: they have {n} points.", { n: String(r.data.points) }) });
      router.refresh();
    });
  }

  return (
    <div className="grid" style={{ gap: 8 }} data-testid="points-form">
      <p className="muted" style={{ margin: 0, fontSize: ".85rem" }}>
        {t(
          "For points a customer was owed, or given by mistake: a minus takes them. The reason is kept with them, on the audit trail.",
        )}
      </p>
      <div
        style={{
          display: "grid",
          gap: 8,
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
        }}
      >
        <Field label={t("Points")}>
          <input
            style={inputStyle}
            value={points}
            inputMode="numeric"
            dir="ltr"
            placeholder="50, -20"
            onChange={(e) => setPoints(e.target.value)}
          />
        </Field>
        <Field label={t("Why")}>
          <input
            style={inputStyle}
            value={reason}
            maxLength={300}
            onChange={(e) => setReason(e.target.value)}
          />
        </Field>
      </div>
      <button
        type="button"
        className="btn-primary"
        style={{ alignSelf: "start" }}
        disabled={busy || !points.trim() || !reason.trim()}
        onClick={save}
      >
        {t("Give or take them")}
      </button>
      <OperationStatus op={op} />
      <Notice msg={msg} />
    </div>
  );
}
