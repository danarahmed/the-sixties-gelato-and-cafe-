"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
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
import { PanelTabs, SidePanel, type PanelTab } from "@/components/SidePanel";
import type { LinkedPhone } from "@/lib/clock";

type Msg = { ok: boolean; text: string } | null;
type Place = { id: string; name: string };
type Login = { id: string; name: string };

/** With this many people or more, a box to find one by name. */
const SEARCH_FROM = 6;

/**
 * Who works here (0049), as the owner chose: a short line a person — their
 * name and what they do, where, whether they are in, their PIN, their phone
 * and their pay — and a tap on it opens a panel with everything else and each
 * thing to change, a tab each (details, PIN, pay, phone, last day). The pay
 * only for those who see payroll; the list downloads as a spreadsheet.
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
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [find, setFind] = useState("");
  // What the last people added came to, said under the list once the form is closed.
  const [added, setAdded] = useState<Msg>(null);
  // A link to the form opens it: Getting set up's /staff#add-person.
  useEffect(() => {
    if (!canManage || window.location.hash !== "#add-person") return;
    setAdding(true);
    document.getElementById("add-person")?.scrollIntoView({ block: "center" });
  }, [canManage]);
  const seesPay = people.some((p) => p.pay !== null);
  const shown = useMemo(() => {
    const q = find.trim().toLowerCase();
    if (!q) return people;
    return people.filter((p) =>
      [p.name, p.title, p.phone, p.location].some((v) => v?.toLowerCase().includes(q)),
    );
  }, [people, find]);
  const person = people.find((p) => p.id === openId) ?? null;

  return (
    <div className="grid" style={{ gap: 12 }}>
      <div className="staff-tools">
        {people.length >= SEARCH_FROM && (
          <input
            type="search"
            className="staff-find"
            style={inputStyle}
            value={find}
            onChange={(e) => setFind(e.target.value)}
            placeholder={t("Find someone…")}
            aria-label={t("Find someone…")}
            data-testid="staff-find"
          />
        )}
        <span style={{ flex: 1 }} />
        {people.length > 0 && (
          <a className="btn-link" href="/staff/export" download data-testid="staff-csv">
            <Icon name="download" size={16} /> {t("Download CSV")}
          </a>
        )}
        {canManage && !adding && (
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              setAdded(null);
              setAdding(true);
            }}
            data-testid="add-person"
            id="add-person"
          >
            <Icon name="plus" size={16} /> {t("Add people")}
          </button>
        )}
      </div>
      {canManage && adding && (
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
      )}
      {!adding && <Notice msg={added} />}
      {people.length === 0 ? (
        <p className="muted" style={{ margin: 0 }} data-testid="staff-empty">
          {t(
            "Nobody is on the staff list yet: add the people who work here, then set their PINs and pay.",
          )}
        </p>
      ) : (
        <ul className="people-list" data-testid="staff-people">
          {shown.map((p) => (
            <PersonLine
              key={p.id}
              p={p}
              seesPay={seesPay}
              phone={phones?.[p.id] ?? null}
              today={today}
              timezone={timezone}
              onOpen={() => setOpenId(p.id)}
            />
          ))}
          {shown.length === 0 && (
            <li className="muted" style={{ padding: "12px 4px" }}>
              {t("Nobody by that name.")}
            </li>
          )}
        </ul>
      )}
      {person && (
        <PersonPanel
          key={person.id}
          p={person}
          seesPay={seesPay}
          places={places}
          logins={logins}
          today={today}
          timezone={timezone}
          canManage={canManage}
          canPay={canPay}
          phones={phones}
          onClose={() => {
            setOpenId(null);
            // Back to the line it was opened from.
            document
              .querySelector<HTMLButtonElement>(
                `[data-testid="person-row"][data-id="${person.id}"] button`,
              )
              ?.focus();
          }}
        />
      )}
    </div>
  );
}

/** Two letters for a face: the first of the first two words. */
function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return words
    .slice(0, 2)
    .map((w) => Array.from(w)[0] ?? "")
    .join("")
    .toUpperCase();
}

/** One person, on one line: tapped, it opens their panel. */
function PersonLine({
  p,
  seesPay,
  phone,
  today,
  timezone,
  onOpen,
}: {
  p: StaffMember;
  seesPay: boolean;
  phone: LinkedPhone | null;
  today: string;
  timezone: string;
  onOpen: () => void;
}) {
  const { t } = useT();
  return (
    <li
      data-testid="person-row"
      data-name={p.name}
      data-id={p.id}
      className={p.worksNow ? "person-line" : "person-line gone"}
    >
      <button type="button" onClick={onOpen} aria-label={t("{name}: open", { name: p.name })}>
        <span className={p.inSince ? "person-face in" : "person-face"} aria-hidden="true">
          {initials(p.name)}
        </span>
        <span className="person-who">
          <b>{p.name}</b>
          <span className="muted">{[p.title, p.location].filter(Boolean).join(" · ")}</span>
        </span>
        <span className="person-marks">
          {p.inSince && (
            <span className="badge ok" data-testid="person-in">
              {t("In since {time}", { time: dateTimeIn(timezone, p.inSince).slice(11) })}
            </span>
          )}
          {p.leftOn && (
            <span className={p.leftOn < today ? "badge" : "badge warn"}>
              {t("Last day {day}", { day: p.leftOn })}
            </span>
          )}
          {p.hiredOn > today && <span className="badge warn">{t("Starts later")}</span>}
          {p.hasPin ? (
            <span className="badge ok">{t("PIN set")}</span>
          ) : (
            <span className="badge warn">{t("No PIN yet")}</span>
          )}
          {phone && (
            <span className="badge ok" data-testid="person-phone">
              <Icon name="phone" size={13} /> {t("Phone linked")}
            </span>
          )}
          {seesPay && (
            <span data-testid="person-pay">
              {p.pay?.basis && p.pay.rate !== null ? (
                <span className="badge">
                  {t(RATE_PER[p.pay.basis], { amount: fmtIQD(p.pay.rate) })}
                </span>
              ) : (
                <span className="badge warn">{t("Pay not set")}</span>
              )}
            </span>
          )}
        </span>
        <span className="person-go" aria-hidden="true">
          <Icon name="chevron" size={18} />
        </span>
      </button>
    </li>
  );
}

/**
 * Everything about one person, beside the list: what is known of them at the
 * top, then a tab for each thing to change. Closed by ✕, Escape, or a tap
 * outside it.
 */
function PersonPanel({
  p,
  seesPay,
  places,
  logins,
  today,
  timezone,
  canManage,
  canPay,
  phones,
  onClose,
}: {
  p: StaffMember;
  seesPay: boolean;
  places: Place[];
  logins: Login[];
  today: string;
  timezone: string;
  canManage: boolean;
  canPay: boolean;
  phones: Record<string, LinkedPhone> | null;
  onClose: () => void;
}) {
  const { t } = useT();
  const phone = phones?.[p.id] ?? null;
  const parts: PanelTab[] = [
    ...(canManage
      ? [
          {
            id: "edit",
            label: t("Details"),
            testId: "edit-person",
            content: (
              <PersonForm
                person={p}
                places={places}
                logins={logins}
                today={today}
                onDone={onClose}
                onCancel={onClose}
              />
            ),
          },
          {
            id: "pin",
            label: p.hasPin ? t("New PIN") : t("Set a PIN"),
            testId: "set-pin",
            content: <PinForm person={p} onDone={onClose} />,
          },
        ]
      : []),
    ...(canPay
      ? [
          {
            id: "pay",
            label: t("Pay"),
            testId: "set-pay",
            content: <PayForm person={p} onDone={onClose} />,
          },
        ]
      : []),
    ...(canManage && phones !== null && p.worksNow
      ? [
          {
            id: "phone",
            label: t("Their phone"),
            testId: "link-phone",
            content: (
              <PhonePanel
                employeeId={p.id}
                name={p.name}
                phone={phone}
                timezone={timezone}
                onClose={onClose}
              />
            ),
          },
        ]
      : []),
    ...(canManage
      ? [
          {
            id: "left",
            label: p.leftOn ? t("Works here again") : t("Last day"),
            testId: "set-left",
            content: <LeftForm person={p} today={today} onDone={onClose} />,
          },
        ]
      : []),
  ];

  const facts: [string, React.ReactNode][] = [
    [t("Where"), p.location],
    [
      t("Started"),
      <span key="d" className="mono">
        {p.hiredOn}
      </span>,
    ],
    [
      t("Phone"),
      p.phone ? (
        <span key="p" className="mono" dir="ltr">
          {p.phone}
        </span>
      ) : (
        "—"
      ),
    ],
    [t("Login"), p.login ?? "—"],
    [t("PIN"), p.hasPin ? t("Set") : t("None yet")],
    ...(phones !== null
      ? [[t("Their phone"), phone ? t("Phone linked") : t("Not linked")] as [string, string]]
      : []),
    ...(seesPay
      ? ([
          [
            t("Pay"),
            p.pay?.basis && p.pay.rate !== null ? (
              <span key="pay">
                {t(RATE_PER[p.pay.basis], { amount: fmtIQD(p.pay.rate) })}
                <span className="muted" style={{ display: "block", fontSize: ".8rem" }}>
                  {t("{hours} hours a day", { hours: String(p.pay.standardHours) })}
                  {p.pay.overtimePercent !== null &&
                    ` · ${t("overtime at {percent}%", { percent: String(p.pay.overtimePercent) })}`}
                </span>
              </span>
            ) : (
              t("Not set")
            ),
          ],
          [
            t("Advances owed"),
            <span key="adv" className="money">
              {p.pay && p.pay.advanceOwed !== 0 ? fmtIQD(p.pay.advanceOwed) : "—"}
            </span>,
          ],
        ] as [string, React.ReactNode][])
      : []),
  ];

  return (
    <SidePanel
      label={p.name}
      onClose={onClose}
      testId="person-panel"
      head={
        <div className="side-panel-who">
          <span className={p.inSince ? "person-face in" : "person-face"} aria-hidden="true">
            {initials(p.name)}
          </span>
          <div style={{ minWidth: 0 }}>
            <h3 style={{ margin: 0 }}>{p.name}</h3>
            <span className="muted" style={{ fontSize: ".85rem" }}>
              {p.title ?? t("No job written yet")}
              {p.inSince &&
                ` · ${t("In since {time}", { time: dateTimeIn(timezone, p.inSince).slice(11) })}`}
            </span>
          </div>
        </div>
      }
    >
      <dl className="panel-facts">
        {facts.map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      <PanelTabs tabs={parts} label={p.name} />
    </SidePanel>
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
