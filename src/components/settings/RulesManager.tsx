"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setBusinessRuleAction } from "@/lib/actions/rules";
import {
  CHOICE_LABEL,
  RULE_HELP,
  RULE_LABEL,
  SCOPE_LABEL,
  typedRuleValue,
  type BusinessRules,
  type RuleDefinition,
  type RuleRow,
  type ScopeType,
} from "@/lib/rules";
import { fmtIQD, fmtQty, itemTypeLabel, roleLabel } from "@/lib/format";
import { dateTimeIn } from "@/lib/dates";
import { useT } from "@/lib/i18n/I18nProvider";
import { Notice, inputStyle } from "@/components/ui";
import { OperationStatus, useOperation } from "@/components/useOperation";

type Msg = { ok: boolean; text: string } | null;
type T = (s: string, v?: Record<string, string | number>) => string;

const ROLES = [
  "owner",
  "general_manager",
  "branch_manager",
  "cashier",
  "barista",
  "inventory_counter",
  "purchasing",
  "accountant",
  "auditor",
];
const ITEM_TYPES = [
  "ingredient",
  "packaging",
  "consumable",
  "finished_good",
  "resale",
  "sub_recipe_output",
];

/** A rule's value as the café reads it: 10%, 25,000 IQD, or its choice. */
function shownValue(def: RuleDefinition, v: number | string | null, t: T): string {
  if (v === null || v === "") return t("Default");
  if (def.key === "daily_sales_target" && Number(v) === 0) return t("No target");
  if (def.kind === "percent") return `${fmtQty(Number(v))}%`;
  if (def.kind === "amount") return fmtIQD(Number(v));
  if (def.kind === "hours") return t("{n} hours", { n: fmtQty(Number(v)) });
  if (def.kind === "minutes") return t("{n} minutes", { n: fmtQty(Number(v)) });
  if (def.kind === "day") return t("Day {n} of the month", { n: fmtQty(Number(v)) });
  if (def.kind === "points") return t("{n} points", { n: fmtQty(Number(v)) });
  return t(CHOICE_LABEL[String(v)] ?? String(v));
}

/** What a row applies to: the whole café, a role, a kind of item, one item. */
function shownScope(scopeType: ScopeType, scopeId: string, scopeName: string | null, t: T): string {
  if (scopeType === "business") return t(SCOPE_LABEL.business);
  if (scopeType === "role") return t(roleLabel(scopeId));
  if (scopeType === "item_type") return t(itemTypeLabel(scopeId));
  return scopeName ?? scopeId;
}

/** The choices a row may take: "no alert at all" only for one item. */
function choicesFor(def: RuleDefinition, scopeType: ScopeType): string[] {
  return def.key === "negative_stock" && scopeType !== "item"
    ? def.choices.filter((c) => c !== "allow")
    : def.choices;
}

/**
 * Settings → Rules (0040): each rule with every row that applies — the whole
 * café's, and any set for a role, a kind of item or one item — who set it,
 * when and why, or its default. A change takes a reason; so does going back
 * to the default. The history of every change is below.
 */
export function RulesManager({
  rules,
  items,
  timezone,
}: {
  rules: BusinessRules;
  items: { id: string; name: string }[];
  timezone: string;
}) {
  const { t, msg: say } = useT();
  const defs = new Map(rules.definitions.map((d) => [d.key, d]));
  return (
    <div className="grid" style={{ gap: 16 }}>
      {rules.definitions.map((def) => (
        <section
          key={def.key}
          id={`rule-${def.key}`}
          className="panel"
          data-testid="rule"
          data-rule={def.key}
        >
          <div className="panel-h">
            <h3>{t(RULE_LABEL[def.key])}</h3>
          </div>
          <div className="panel-b grid" style={{ gap: 10 }}>
            <p className="muted" style={{ margin: 0, fontSize: ".85rem" }}>
              {t(RULE_HELP[def.key])}
            </p>
            <div className="tw">
              <table>
                <thead>
                  <tr>
                    <th>{t("Applies to")}</th>
                    <th>{t("Rule")}</th>
                    <th>{t("Set")}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {rules.rows
                    .filter((r) => r.key === def.key)
                    .map((r) => (
                      <RuleRowView
                        key={`${r.scopeType}:${r.scopeId}`}
                        def={def}
                        row={r}
                        timezone={timezone}
                      />
                    ))}
                </tbody>
              </table>
            </div>
            {def.scopes.some((s) => s !== "business") && <AddRule def={def} items={items} />}
          </div>
        </section>
      ))}

      <section className="panel" data-testid="rule-history">
        <div className="panel-h">
          <h3>{t("Every change")}</h3>
        </div>
        {rules.history.length === 0 ? (
          <div className="panel-b muted">{t("No rule has been changed yet.")}</div>
        ) : (
          <div className="tw">
            <table>
              <thead>
                <tr>
                  <th>{t("When")}</th>
                  <th>{t("Rule")}</th>
                  <th>{t("Applies to")}</th>
                  <th>{t("From")}</th>
                  <th>{t("To")}</th>
                  <th>{t("Why")}</th>
                  <th>{t("Who")}</th>
                </tr>
              </thead>
              <tbody>
                {rules.history.map((h, i) => {
                  const def = defs.get(h.key);
                  return (
                    <tr key={`${h.changedAt}-${i}`} data-testid="rule-change">
                      <td className="mono muted" style={{ fontSize: ".8rem" }}>
                        {dateTimeIn(timezone, h.changedAt)}
                      </td>
                      <td>{t(RULE_LABEL[h.key])}</td>
                      <td>{shownScope(h.scopeType, h.scopeId, h.scopeName, t)}</td>
                      <td>{def ? shownValue(def, h.oldValue, t) : "—"}</td>
                      <td>{def ? shownValue(def, h.newValue, t) : "—"}</td>
                      <td>{say(h.reason)}</td>
                      <td>{h.changedBy ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

/** One row of a rule: what it applies to, its value, who set it; change it, or set it back. */
function RuleRowView({
  def,
  row,
  timezone,
}: {
  def: RuleDefinition;
  row: RuleRow;
  timezone: string;
}) {
  const { t, msg: say } = useT();
  const [editing, setEditing] = useState<"change" | "default" | null>(null);
  return (
    <>
      <tr data-testid="rule-row" data-scope={`${row.scopeType}:${row.scopeId}`}>
        <td>{shownScope(row.scopeType, row.scopeId, row.scopeName, t)}</td>
        <td data-testid="rule-value">
          <b>{shownValue(def, row.value, t)}</b>
        </td>
        <td className="muted" style={{ fontSize: ".8rem" }}>
          {row.isDefault ? (
            t("Default")
          ) : (
            <>
              {t("{who}, {when}", {
                who: row.setBy ?? "—",
                when: row.setAt ? dateTimeIn(timezone, row.setAt) : "—",
              })}
              {row.reason && (
                <>
                  <br />
                  {say(row.reason)}
                </>
              )}
            </>
          )}
        </td>
        <td style={{ whiteSpace: "nowrap" }}>
          <button type="button" className="linklike" onClick={() => setEditing("change")}>
            {t("Change")}
          </button>
          {!row.isDefault && (
            <>
              {" · "}
              <button type="button" className="linklike" onClick={() => setEditing("default")}>
                {t("Back to default")}
              </button>
            </>
          )}
        </td>
      </tr>
      {editing && (
        <tr>
          <td colSpan={4}>
            <RuleForm
              def={def}
              scopeType={row.scopeType}
              scopeId={row.scopeId}
              current={row.value}
              toDefault={editing === "default"}
              onDone={() => setEditing(null)}
            />
          </td>
        </tr>
      )}
    </>
  );
}

/** A new row for a rule: for a role, a kind of item, or one item. */
function AddRule({ def, items }: { def: RuleDefinition; items: { id: string; name: string }[] }) {
  const { t } = useT();
  const scopes = def.scopes.filter((s) => s !== "business" && s !== "location");
  const [open, setOpen] = useState(false);
  const [scopeType, setScopeType] = useState<ScopeType>(scopes[0] ?? "role");
  const targets: [string, string][] =
    scopeType === "role"
      ? ROLES.map((r) => [r, t(roleLabel(r))])
      : scopeType === "item_type"
        ? ITEM_TYPES.map((k) => [k, t(itemTypeLabel(k))])
        : items.map((i) => [i.id, i.name]);
  const [scopeId, setScopeId] = useState("");
  if (scopes.length === 0) return null;
  if (!open)
    return (
      <div>
        <button type="button" onClick={() => setOpen(true)} data-testid="rule-add">
          {t("+ Set it for {what}", {
            what: scopes.map((s) => t(SCOPE_LABEL[s]).toLowerCase()).join(" / "),
          })}
        </button>
      </div>
    );
  return (
    <div className="card grid" style={{ gap: 8 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {scopes.length > 1 && (
          <select
            style={inputStyle}
            aria-label={t("Applies to")}
            value={scopeType}
            onChange={(e) => {
              setScopeType(e.target.value as ScopeType);
              setScopeId("");
            }}
          >
            {scopes.map((s) => (
              <option key={s} value={s}>
                {t(SCOPE_LABEL[s])}
              </option>
            ))}
          </select>
        )}
        <select
          style={inputStyle}
          aria-label={t(SCOPE_LABEL[scopeType])}
          data-testid="rule-target"
          value={scopeId}
          onChange={(e) => setScopeId(e.target.value)}
        >
          <option value="">{t("Choose…")}</option>
          {targets.map(([v, label]) => (
            <option key={v} value={v}>
              {label}
            </option>
          ))}
        </select>
      </div>
      {scopeId && (
        <RuleForm
          def={def}
          scopeType={scopeType}
          scopeId={scopeId}
          current={null}
          toDefault={false}
          onDone={() => {
            setOpen(false);
            setScopeId("");
          }}
        />
      )}
      {!scopeId && (
        <div>
          <button type="button" className="linklike" onClick={() => setOpen(false)}>
            {t("Cancel")}
          </button>
        </div>
      )}
    </div>
  );
}

/** The value and the reason for one row of a rule; saved with a key, like every write. */
function RuleForm({
  def,
  scopeType,
  scopeId,
  current,
  toDefault,
  onDone,
}: {
  def: RuleDefinition;
  scopeType: ScopeType;
  scopeId: string;
  current: number | string | null;
  toDefault: boolean;
  onDone: () => void;
}) {
  const { t } = useT();
  const router = useRouter();
  const op = useOperation();
  const [busy, start] = useTransition();
  const [msg, setMsg] = useState<Msg>(null);
  const choices = choicesFor(def, scopeType);
  const [typed, setTyped] = useState(
    current === null || current === ""
      ? def.kind === "choice"
        ? (choices[0] ?? "")
        : ""
      : String(current),
  );
  const [reason, setReason] = useState("");

  function save() {
    setMsg(null);
    let value: number | string | null = null;
    if (!toDefault) {
      const v = typedRuleValue(def, typed);
      if (!v.ok) {
        setMsg({ ok: false, text: t(v.error) });
        return;
      }
      value = v.value;
    }
    start(async () => {
      const r = await op.run("setRule", (key) =>
        setBusinessRuleAction(
          {
            key: def.key,
            scopeType,
            scopeId: scopeType === "business" ? null : scopeId,
            value,
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
    <form
      className="grid"
      style={{ gap: 8 }}
      data-testid="rule-form"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
        {!toDefault &&
          (def.kind === "choice" ? (
            <select
              style={inputStyle}
              aria-label={t("Rule")}
              data-testid="rule-input"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
            >
              {choices.map((c) => (
                <option key={c} value={c}>
                  {t(CHOICE_LABEL[c] ?? c)}
                </option>
              ))}
            </select>
          ) : (
            <input
              style={{ ...inputStyle, width: 140 }}
              aria-label={t("Rule")}
              data-testid="rule-input"
              inputMode="decimal"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={
                def.kind === "percent"
                  ? "%"
                  : def.kind === "hours"
                    ? t("hours")
                    : def.kind === "minutes"
                      ? t("minutes")
                      : def.kind === "day"
                        ? t("day")
                        : def.kind === "points"
                          ? t("points")
                          : "IQD"
              }
            />
          ))}
        <input
          style={{ ...inputStyle, flex: 1, minWidth: 220 }}
          aria-label={t("Why (required)")}
          data-testid="rule-reason"
          placeholder={t("Why (required)")}
          value={reason}
          maxLength={300}
          onChange={(e) => setReason(e.target.value)}
        />
        <button className="btn-primary" type="submit" disabled={busy || !reason.trim()}>
          {toDefault ? t("Set it back to the default") : t("Save")}
        </button>
        <button type="button" className="linklike" onClick={onDone}>
          {t("Cancel")}
        </button>
      </div>
      <OperationStatus op={op} />
      <Notice msg={msg} />
    </form>
  );
}
