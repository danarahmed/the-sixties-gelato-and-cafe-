"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  saveEmployeeAction,
  setClockPinAction,
  setEmployeeLeftAction,
  setEmployeePayAction,
} from "@/lib/actions/staff";
import { PAY_BASES, PAY_BASIS_LABEL, RATE_PER, type PayBasis, type StaffMember } from "@/lib/staff";
import { fmtIQD } from "@/lib/format";
import { dateTimeIn } from "@/lib/dates";
import { useT } from "@/lib/i18n/I18nProvider";
import { Field, Notice, inputStyle } from "@/components/ui";
import { OperationStatus, useOperation } from "@/components/useOperation";
import { AddPeople } from "@/components/staff/AddPeople";
import { Icon } from "@/components/Icon";
import { PhonePanel } from "@/components/staff/PhonePanel";
import type { LinkedPhone } from "@/lib/clock";

type Msg = { ok: boolean; text: string } | null;
type Place = { id: string; name: string };
type Login = { id: string; name: string };
type Open = { what: "edit" | "pin" | "pay" | "left" | "phone"; id: string } | null;

/**
 * Who works here (0049): each person, where they work, since when, their
 * login and whether they have a PIN to clock with; their pay only for those
 * who see payroll. A manager adds people and sets their PINs; those who run
 * payroll set what they are paid.
 */
export function StaffPeople({
  people,
  places,
  logins,
  today,
  timezone,
  canManage,
  canPay,
  phones = null,
}: {
  people: StaffMember[];
  places: Place[];
  logins: Login[];
  today: string;
  timezone: string;
  /** staff.manage: add people, their details, PINs and last days. */
  canManage: boolean;
  /** payroll.run: set pay. */
  canPay: boolean;
  /** Whose own phone is linked to clock with (0068); null before the database has it. */
  phones?: Record<string, LinkedPhone> | null;
}) {
  const { t } = useT();
  const [open, setOpen] = useState<Open>(null);
  const [adding, setAdding] = useState(false);
  // What the last people added came to, said under the list once the form is closed.
  const [added, setAdded] = useState<Msg>(null);
  // A link to the form opens it: Getting set up's /staff#add-person.
  useEffect(() => {
    if (!canManage || window.location.hash !== "#add-person") return;
    setAdding(true);
    document.getElementById("add-person")?.scrollIntoView({ block: "center" });
  }, [canManage]);
  const seesPay = people.some((p) => p.pay !== null);
  const toggle = (what: NonNullable<Open>["what"], id: string) =>
    setOpen((o) => (o && o.what === what && o.id === id ? null : { what, id }));

  return (
    <div className="grid" style={{ gap: 12 }}>
      {people.length === 0 ? (
        <p className="muted" style={{ margin: 0 }} data-testid="staff-empty">
          {t(
            "Nobody is on the staff list yet: add the people who work here, then set their PINs and pay.",
          )}
        </p>
      ) : (
        <div className="tw">
          <table data-testid="staff-people">
            <thead>
              <tr>
                <th>{t("Name")}</th>
                <th>{t("Where")}</th>
                <th>{t("Started")}</th>
                <th>{t("Login")}</th>
                <th>{t("PIN")}</th>
                {seesPay && <th>{t("Pay")}</th>}
                {seesPay && <th className="right">{t("Advances owed")}</th>}
                <th />
              </tr>
            </thead>
            <tbody>
              {people.map((p) => (
                <PersonRow
                  key={p.id}
                  p={p}
                  seesPay={seesPay}
                  open={open?.id === p.id ? open.what : null}
                  toggle={toggle}
                  close={() => setOpen(null)}
                  places={places}
                  logins={logins}
                  today={today}
                  timezone={timezone}
                  canManage={canManage}
                  canPay={canPay}
                  phones={phones}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
      {canManage &&
        (adding ? (
          <div className="card grid" style={{ gap: 10 }} id="add-person">
            <b>{t("People to add")}</b>
            <AddPeople
              places={places}
              logins={logins}
              today={today}
              onDone={(n, pinsNotSet) => {
                setAdding(false);
                setAdded({
                  ok: pinsNotSet.length === 0,
                  text: [t("{n} added to the staff.", { n }), ...pinsNotSet].join(" "),
                });
              }}
              onCancel={() => setAdding(false)}
            />
          </div>
        ) : (
          <button
            type="button"
            style={{ alignSelf: "start" }}
            onClick={() => {
              setAdded(null);
              setAdding(true);
            }}
            data-testid="add-person"
            id="add-person"
          >
            {t("+ Add people who work here")}
          </button>
        ))}
      {!adding && <Notice msg={added} />}
    </div>
  );
}

function PersonRow({
  p,
  seesPay,
  open,
  toggle,
  close,
  places,
  logins,
  today,
  timezone,
  canManage,
  canPay,
  phones,
}: {
  p: StaffMember;
  seesPay: boolean;
  open: NonNullable<Open>["what"] | null;
  toggle: (what: NonNullable<Open>["what"], id: string) => void;
  close: () => void;
  places: Place[];
  logins: Login[];
  today: string;
  timezone: string;
  canManage: boolean;
  canPay: boolean;
  phones: Record<string, LinkedPhone> | null;
}) {
  const { t } = useT();
  const cols = 6 + (seesPay ? 2 : 0);
  const phone = phones?.[p.id] ?? null;
  return (
    <>
      <tr
        data-testid="person-row"
        data-name={p.name}
        style={p.worksNow ? undefined : { opacity: 0.6 }}
      >
        <td>
          <b>{p.name}</b>
          {p.title && <span className="muted"> · {p.title}</span>}
          {p.inSince && (
            <div>
              <span className="badge ok" data-testid="person-in">
                {t("In since {time}", { time: dateTimeIn(timezone, p.inSince).slice(11) })}
              </span>
            </div>
          )}
          {p.phone && (
            <div className="muted mono" style={{ fontSize: ".8rem" }}>
              {p.phone}
            </div>
          )}
        </td>
        <td>{p.location}</td>
        <td className="mono" style={{ fontSize: ".85rem" }}>
          {p.hiredOn}
          {p.leftOn && (
            <div className={p.leftOn < today ? "badge" : "badge warn"}>
              {t("Last day {day}", { day: p.leftOn })}
            </div>
          )}
          {p.hiredOn > today && <div className="badge warn">{t("Starts later")}</div>}
        </td>
        <td>{p.login ?? "—"}</td>
        <td>
          {p.hasPin ? (
            <span className="badge ok">{t("Set")}</span>
          ) : (
            <span className="badge warn">{t("None yet")}</span>
          )}
          {phone && (
            <div>
              <span className="badge ok" data-testid="person-phone">
                <Icon name="phone" size={13} /> {t("Phone linked")}
              </span>
            </div>
          )}
        </td>
        {seesPay && (
          <td data-testid="person-pay">
            {p.pay?.basis && p.pay.rate !== null ? (
              <>
                {t(RATE_PER[p.pay.basis], { amount: fmtIQD(p.pay.rate) })}
                <div className="muted" style={{ fontSize: ".8rem" }}>
                  {t("{hours} hours a day", { hours: String(p.pay.standardHours) })}
                  {p.pay.overtimePercent !== null &&
                    ` · ${t("overtime at {percent}%", { percent: String(p.pay.overtimePercent) })}`}
                </div>
              </>
            ) : (
              <span className="badge warn">{t("Not set")}</span>
            )}
          </td>
        )}
        {seesPay && (
          <td className="right money">
            {p.pay && p.pay.advanceOwed !== 0 ? fmtIQD(p.pay.advanceOwed) : "—"}
          </td>
        )}
        <td>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {canManage && (
              <button type="button" onClick={() => toggle("edit", p.id)} data-testid="edit-person">
                {t("Edit")}
              </button>
            )}
            {canManage && (
              <button type="button" onClick={() => toggle("pin", p.id)} data-testid="set-pin">
                {p.hasPin ? t("New PIN") : t("Set a PIN")}
              </button>
            )}
            {canPay && (
              <button type="button" onClick={() => toggle("pay", p.id)} data-testid="set-pay">
                {t("Set the pay…")}
              </button>
            )}
            {canManage && phones !== null && p.worksNow && (
              <button type="button" onClick={() => toggle("phone", p.id)} data-testid="link-phone">
                <Icon name="phone" size={15} /> {phone ? t("Their phone…") : t("Link their phone")}
              </button>
            )}
            {canManage && (
              <button type="button" onClick={() => toggle("left", p.id)} data-testid="set-left">
                {p.leftOn ? t("Works here again…") : t("Last day…")}
              </button>
            )}
          </div>
        </td>
      </tr>
      {open && (
        <tr>
          <td colSpan={cols}>
            {open === "edit" && (
              <PersonForm
                person={p}
                places={places}
                logins={logins}
                today={today}
                onDone={close}
                onCancel={close}
              />
            )}
            {open === "pin" && <PinForm person={p} onDone={close} />}
            {open === "pay" && <PayForm person={p} onDone={close} />}
            {open === "left" && <LeftForm person={p} today={today} onDone={close} />}
            {open === "phone" && (
              <PhonePanel
                employeeId={p.id}
                name={p.name}
                phone={phone}
                timezone={timezone}
                onClose={close}
              />
            )}
          </td>
        </tr>
      )}
    </>
  );
}

/** Someone new, or their details. */
function PersonForm({
  person,
  places,
  logins,
  today,
  onDone,
  onCancel,
}: {
  person?: StaffMember;
  places: Place[];
  logins: Login[];
  today: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const op = useOperation();
  const { t } = useT();
  const router = useRouter();
  const [busy, start] = useTransition();
  const [name, setName] = useState(person?.name ?? "");
  const [phone, setPhone] = useState(person?.phone ?? "");
  const [title, setTitle] = useState(person?.title ?? "");
  const [place, setPlace] = useState(person?.locationId ?? places[0]?.id ?? "");
  const [hiredOn, setHiredOn] = useState(person?.hiredOn ?? today);
  const [login, setLogin] = useState(person?.appUserId ?? "");
  const [msg, setMsg] = useState<Msg>(null);

  function save() {
    setMsg(null);
    start(async () => {
      const r = await op.run("saveEmployee", (key) =>
        saveEmployeeAction(
          {
            employeeId: person?.id ?? null,
            name,
            phone,
            title,
            locationId: place,
            hiredOn,
            appUserId: login || null,
          },
          key,
        ),
      );
      if (!r.ok) {
        setMsg({ ok: false, text: r.error });
        return;
      }
      router.refresh();
      onDone();
    });
  }

  return (
    <div className="grid" style={{ gap: 8 }} data-testid="person-form">
      <div
        style={{
          display: "grid",
          gap: 8,
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        }}
      >
        <Field label={t("Name")}>
          <input
            style={inputStyle}
            value={name}
            maxLength={80}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <Field label={t("What they do")}>
          <input
            style={inputStyle}
            value={title}
            maxLength={60}
            placeholder={t("e.g. Barista")}
            onChange={(e) => setTitle(e.target.value)}
          />
        </Field>
        <Field label={t("Phone")}>
          <input
            style={inputStyle}
            value={phone}
            dir="ltr"
            inputMode="tel"
            maxLength={40}
            onChange={(e) => setPhone(e.target.value)}
          />
        </Field>
        <Field label={t("Where they work")}>
          <select style={inputStyle} value={place} onChange={(e) => setPlace(e.target.value)}>
            {places.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("Started on")}>
          <input
            type="date"
            style={inputStyle}
            value={hiredOn}
            onChange={(e) => setHiredOn(e.target.value)}
          />
        </Field>
        <Field label={t("Their login, if they have one")}>
          <select style={inputStyle} value={login} onChange={(e) => setLogin(e.target.value)}>
            <option value="">{t("No login")}</option>
            {logins.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button className="btn-primary" disabled={busy || !name.trim() || !place} onClick={save}>
          {busy ? t("Saving…") : person ? t("Save") : t("Add them")}
        </button>
        <button type="button" onClick={onCancel} disabled={busy}>
          {t("Cancel")}
        </button>
      </div>
      <OperationStatus op={op} />
      <Notice msg={msg} />
    </div>
  );
}

/** The PIN someone clocks with: typed by them, twice. */
function PinForm({ person, onDone }: { person: StaffMember; onDone: () => void }) {
  const { t } = useT();
  const router = useRouter();
  const [busy, start] = useTransition();
  const [pin, setPin] = useState("");
  const [again, setAgain] = useState("");
  const [msg, setMsg] = useState<Msg>(null);

  function save() {
    setMsg(null);
    if (pin !== again) {
      setMsg({ ok: false, text: t("The two PINs are not the same") });
      return;
    }
    start(async () => {
      const r = await setClockPinAction({ employeeId: person.id, pin });
      if (!r.ok) {
        setMsg({ ok: false, text: r.error });
        return;
      }
      setMsg({ ok: true, text: t("{name} clocks in with this PIN now.", { name: person.name }) });
      setPin("");
      setAgain("");
      router.refresh();
      setTimeout(onDone, 1200);
    });
  }

  return (
    <div className="grid" style={{ gap: 8 }} data-testid="pin-form">
      <p className="muted" style={{ margin: 0, fontSize: ".85rem" }}>
        {t(
          "Let {name} type it: 4 to 8 digits, not one digit over and over, nor a run like 1234. They clock in and out at the till with their name and this PIN.",
          { name: person.name },
        )}
      </p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input
          type="password"
          inputMode="numeric"
          autoComplete="off"
          aria-label={t("PIN")}
          style={{ ...inputStyle, maxWidth: 160 }}
          value={pin}
          maxLength={8}
          onChange={(e) => setPin(e.target.value)}
        />
        <input
          type="password"
          inputMode="numeric"
          autoComplete="off"
          aria-label={t("The same PIN again")}
          placeholder={t("The same PIN again")}
          style={{ ...inputStyle, maxWidth: 200 }}
          value={again}
          maxLength={8}
          onChange={(e) => setAgain(e.target.value)}
        />
        <button className="btn-primary" disabled={busy || pin.length < 4} onClick={save}>
          {busy ? t("Saving…") : t("Save the PIN")}
        </button>
      </div>
      <Notice msg={msg} />
    </div>
  );
}

/** What someone is paid. */
function PayForm({ person, onDone }: { person: StaffMember; onDone: () => void }) {
  const op = useOperation();
  const { t } = useT();
  const router = useRouter();
  const [busy, start] = useTransition();
  const [basis, setBasis] = useState<PayBasis>(person.pay?.basis ?? "monthly");
  const [rate, setRate] = useState(person.pay?.rate != null ? String(person.pay.rate) : "");
  const [hours, setHours] = useState(String(person.pay?.standardHours || 8));
  const [overtime, setOvertime] = useState(
    person.pay?.overtimePercent != null ? String(person.pay.overtimePercent) : "",
  );
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState<Msg>(null);

  function save() {
    setMsg(null);
    start(async () => {
      const r = await op.run("setEmployeePay", (key) =>
        setEmployeePayAction(
          {
            employeeId: person.id,
            basis,
            rate,
            standardHours: hours,
            overtimePercent: overtime || null,
            reason,
          },
          key,
        ),
      );
      if (!r.ok) {
        setMsg({ ok: false, text: r.error });
        return;
      }
      router.refresh();
      onDone();
    });
  }

  return (
    <div className="grid" style={{ gap: 8 }} data-testid="pay-form">
      <div
        style={{
          display: "grid",
          gap: 8,
          gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
        }}
      >
        <Field label={t("How they are paid")}>
          <select
            style={inputStyle}
            value={basis}
            onChange={(e) => setBasis(e.target.value as PayBasis)}
          >
            {PAY_BASES.map((b) => (
              <option key={b} value={b}>
                {t(PAY_BASIS_LABEL[b])}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t(RATE_PER[basis], { amount: t("Pay") })}>
          <input
            style={inputStyle}
            inputMode="decimal"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
          />
        </Field>
        <Field label={t("A day's hours")}>
          <input
            style={inputStyle}
            inputMode="decimal"
            value={hours}
            onChange={(e) => setHours(e.target.value)}
          />
        </Field>
        <Field label={t("Overtime at (% of an hour's pay; empty: the café's rule)")}>
          <input
            style={inputStyle}
            inputMode="decimal"
            value={overtime}
            onChange={(e) => setOvertime(e.target.value)}
          />
        </Field>
        <Field label={t("Why it changes (optional)")}>
          <input style={inputStyle} value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
      </div>
      <p className="muted" style={{ margin: 0, fontSize: ".8rem" }}>
        {t(
          "Overtime is each hour worked beyond a day's hours. An hour's pay is an hourly rate; a day's pay over a day's hours; or a month's pay over 30 days and a day's hours.",
        )}
      </p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button className="btn-primary" disabled={busy || !rate.trim()} onClick={save}>
          {busy ? t("Saving…") : t("Save the pay")}
        </button>
        <button type="button" onClick={onDone} disabled={busy}>
          {t("Cancel")}
        </button>
      </div>
      <OperationStatus op={op} />
      <Notice msg={msg} />
    </div>
  );
}

/** Someone's last day, or back to working here. */
function LeftForm({
  person,
  today,
  onDone,
}: {
  person: StaffMember;
  today: string;
  onDone: () => void;
}) {
  const op = useOperation();
  const { t } = useT();
  const router = useRouter();
  const [busy, start] = useTransition();
  const [leftOn, setLeftOn] = useState(person.leftOn ?? today);
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState<Msg>(null);
  const back = person.leftOn !== null;

  function save() {
    setMsg(null);
    start(async () => {
      const r = await op.run("setEmployeeLeft", (key) =>
        setEmployeeLeftAction({ employeeId: person.id, leftOn: back ? null : leftOn, reason }, key),
      );
      if (!r.ok) {
        setMsg({ ok: false, text: r.error });
        return;
      }
      router.refresh();
      onDone();
    });
  }

  return (
    <div className="grid" style={{ gap: 8 }} data-testid="left-form">
      {!back && (
        <p className="muted" style={{ margin: 0, fontSize: ".85rem" }}>
          {t(
            "After their last day they no longer clock in, and their hours on the schedule after it are taken off. Their records and pay stay.",
          )}
        </p>
      )}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {!back && (
          <input
            type="date"
            aria-label={t("Their last day")}
            style={{ ...inputStyle, maxWidth: 180 }}
            value={leftOn}
            onChange={(e) => setLeftOn(e.target.value)}
          />
        )}
        <input
          aria-label={t("Why")}
          placeholder={
            back ? t("Why? e.g. came back after the summer") : t("Why? e.g. moved to Erbil")
          }
          style={inputStyle}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        <button className="btn-primary" disabled={busy || !reason.trim()} onClick={save}>
          {busy ? t("Saving…") : back ? t("They work here again") : t("Save their last day")}
        </button>
      </div>
      <OperationStatus op={op} />
      <Notice msg={msg} />
    </div>
  );
}
