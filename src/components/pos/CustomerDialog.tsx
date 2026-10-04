"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { customerAtTillAction, findCustomerAction } from "@/lib/actions/customers";
import { addressText, phoneText, type TillCustomer } from "@/lib/customers";
import { useT } from "@/lib/i18n/I18nProvider";
import { CustomerForm } from "@/components/customers/CustomerForm";
import { AddressForm } from "@/components/customers/CustomerPanel";
import type { OrderCustomer } from "./model";
import { useDialogFocus } from "./dialogFocus";

/**
 * The customer on an order (0050): found by their number, typed any way, or
 * added when nobody has it; their points and the rewards they come to; and,
 * for a delivery by the café's own driver, the address it goes to.
 */
export function CustomerDialog({
  current,
  delivery,
  why,
  canAdd,
  onChoose,
  onClose,
}: {
  /** The order's customer now, if it has one. */
  current: OrderCustomer | null;
  /** The café's own driver takes it: an address must be chosen. */
  delivery: boolean;
  /** Why the dialog was opened: a delivery needs a customer. */
  why?: string | null;
  /** customer.edit: a customer may be added here. */
  canAdd: boolean;
  onChoose: (c: OrderCustomer | null) => void;
  onClose: () => void;
}) {
  const { t, msg: say } = useT();
  const dialogBox = useDialogFocus<HTMLDivElement>();
  const [phone, setPhone] = useState("");
  const [found, setFound] = useState<TillCustomer | null>(null);
  const [nobody, setNobody] = useState(false);
  const [adding, setAdding] = useState(false);
  const [addingAddress, setAddingAddress] = useState(false);
  const [addressId, setAddressId] = useState<string | null>(current?.addressId ?? null);
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const input = useRef<HTMLInputElement>(null);

  // The order's customer, read again: their points and addresses now.
  useEffect(() => {
    if (!current) {
      input.current?.focus();
      return;
    }
    let live = true;
    void customerAtTillAction(current.id).then((r) => {
      if (live && r.ok) setFound(r.data);
    });
    return () => {
      live = false;
    };
  }, [current]);

  function load(id: string) {
    start(async () => {
      const r = await customerAtTillAction(id);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setFound(r.data);
    });
  }

  function find() {
    setError(null);
    setNobody(false);
    setFound(null);
    start(async () => {
      const r = await findCustomerAction(phone);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      if (r.data === null) setNobody(true);
      else {
        setFound(r.data);
        setAddressId(r.data.addresses[0]?.id ?? null);
      }
    });
  }

  const addresses = found?.addresses.filter((a) => a.active) ?? [];
  const chosen = addresses.find((a) => a.id === addressId) ?? null;
  const needsAddress = delivery && chosen === null;

  function choose() {
    if (!found || !found.active || needsAddress) return;
    onChoose({
      id: found.id,
      name: found.name,
      phone: found.phone,
      points: found.points,
      addressId: delivery ? (chosen?.id ?? null) : null,
      address: delivery && chosen ? addressText(chosen) : null,
    });
  }

  return (
    <div className="pos-modal-back" onClick={() => !busy && onClose()}>
      <div
        ref={dialogBox}
        tabIndex={-1}
        className="pos-modal"
        role="dialog"
        aria-modal="true"
        aria-label={t("Customer")}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Escape" && !busy) onClose();
        }}
        data-testid="customer-dialog"
      >
        <h2 style={{ margin: "0 0 8px" }}>{t("Customer")}</h2>
        {why && (
          <p className="badge warn" style={{ whiteSpace: "normal" }}>
            {say(why)}
          </p>
        )}
        {!found && !adding && (
          <form
            className="grid"
            style={{ gap: 8 }}
            onSubmit={(e) => {
              e.preventDefault();
              if (phone.trim()) find();
            }}
          >
            <label className="grid" style={{ gap: 4 }}>
              <span className="muted">{t("Their phone number")}</span>
              <input
                ref={input}
                value={phone}
                dir="ltr"
                inputMode="tel"
                maxLength={40}
                placeholder="0770 123 4567"
                onChange={(e) => setPhone(e.target.value)}
                data-testid="customer-phone"
              />
            </label>
            <button
              type="submit"
              className="btn-primary"
              disabled={busy || !phone.trim()}
              data-testid="customer-find"
            >
              {t("Find")}
            </button>
            {nobody && (
              <div className="grid" style={{ gap: 6 }} data-testid="customer-nobody">
                <span className="muted">{t("Nobody has that number yet.")}</span>
                {canAdd && (
                  <button type="button" onClick={() => setAdding(true)} data-testid="customer-add">
                    {t("Add them as a customer")}
                  </button>
                )}
              </div>
            )}
          </form>
        )}

        {adding && (
          <CustomerForm
            phone={phone}
            onDone={(saved) => {
              setAdding(false);
              setNobody(false);
              load(saved.customerId);
            }}
            onCancel={() => setAdding(false)}
          />
        )}

        {found && (
          <div className="grid" style={{ gap: 8 }} data-testid="customer-found">
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "baseline" }}>
              <strong style={{ fontSize: "1.1rem" }}>{found.name}</strong>
              <span className="mono" dir="ltr">
                {phoneText(found.phone)}
              </span>
              <span className="badge ok" data-testid="customer-points">
                {t("{n} points", { n: String(found.points) })}
              </span>
              {found.loyalty && found.rewards > 0 && (
                <span className="badge warn" data-testid="customer-rewards">
                  {t("{n} rewards to take", { n: String(found.rewards) })}
                </span>
              )}
            </div>
            {found.notes && <p style={{ margin: 0 }}>{found.notes}</p>}
            {!found.active && (
              <p className="badge err" style={{ whiteSpace: "normal" }}>
                {t("{name} is put away on Customers: bring them back there first.", {
                  name: found.name,
                })}
              </p>
            )}
            {delivery && (
              <div className="grid" style={{ gap: 6 }}>
                <span className="muted">{t("Deliver to")}</span>
                {addresses.length === 0 && (
                  <span className="muted">{t("No address yet: add where it goes.")}</span>
                )}
                {addresses.map((a) => (
                  <label key={a.id} style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
                    <input
                      type="radio"
                      name="deliver-to"
                      checked={addressId === a.id}
                      onChange={() => setAddressId(a.id)}
                      data-testid="customer-address-choice"
                    />
                    <span>
                      {a.label && <b>{a.label}: </b>}
                      {addressText(a)}
                    </span>
                  </label>
                ))}
                {canAdd &&
                  (addingAddress ? (
                    <AddressForm
                      customerId={found.id}
                      atTill
                      onDone={(id) => {
                        setAddingAddress(false);
                        setAddressId(id);
                        load(found.id);
                      }}
                      onCancel={() => setAddingAddress(false)}
                    />
                  ) : (
                    <button
                      type="button"
                      style={{ alignSelf: "start" }}
                      onClick={() => setAddingAddress(true)}
                      data-testid="customer-add-address"
                    >
                      {t("+ Add an address")}
                    </button>
                  ))}
              </div>
            )}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                type="button"
                className="btn-primary"
                disabled={busy || !found.active || needsAddress}
                onClick={choose}
                data-testid="customer-choose"
              >
                {t("Put them on the order")}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setFound(null);
                  setPhone("");
                  setNobody(false);
                }}
              >
                {t("Someone else")}
              </button>
            </div>
          </div>
        )}

        {error && (
          <p className="badge err" style={{ whiteSpace: "normal" }} data-testid="customer-error">
            {say(error)}
          </p>
        )}
        <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
          {current && (
            <button type="button" onClick={() => onChoose(null)} data-testid="customer-remove">
              {t("Take {name} off the order", { name: current.name })}
            </button>
          )}
          <button type="button" onClick={onClose} disabled={busy}>
            {t("pos.close")}
          </button>
        </div>
      </div>
    </div>
  );
}
