import Link from "next/link";
import { getT } from "@/lib/i18n/server";
import { BUILT_IN_LANGUAGES } from "@/lib/i18n/core";
import { has, requirePermission } from "@/lib/auth/session";
import { ROLE_PERMISSIONS, type Role } from "@domain/auth/permissions.js";
import { getBusinessConfig, getLocations } from "@/lib/db/read";
import { getMembers } from "@/lib/db/reports";
import { fmtIQD, roleLabel } from "@/lib/format";
import { businessToday } from "@/lib/dates";
import { PeopleManager } from "@/components/PeopleManager";
import { getAlertThresholds } from "@/lib/db/alerts";
import { AlertThresholds } from "./AlertThresholds";

export const dynamic = "force-dynamic";

// Phrases of the settings book, shown through t().
const KIND_LABEL: Record<string, string> = {
  branch: "Branch",
  central_kitchen: "Central kitchen",
  warehouse: "Warehouse",
};

export default async function SettingsPage() {
  const profile = await requirePermission("settings.manage");
  const t = await getT();
  const today = businessToday(profile.timezone);
  const [cfg, locations, members, thresholds] = await Promise.all([
    getBusinessConfig(),
    getLocations(),
    getMembers(),
    getAlertThresholds(),
  ]);

  // Each setting's name is a phrase, shown through t() below.
  const config: [string, string][] = cfg
    ? [
        ["Business name", cfg.name],
        [
          "Currency",
          t("{code} — {n} decimal places", { code: cfg.currencyCode, n: cfg.currencyDecimals }),
        ],
        [
          "Timezone",
          t("{timezone} — every trading day and period runs midnight to midnight here", {
            timezone: t(cfg.timezone),
          }),
        ],
        [
          "Default language",
          BUILT_IN_LANGUAGES.find((l) => l.code === cfg.defaultLocale)?.label ?? cfg.defaultLocale,
        ],
        [
          "Negative stock",
          cfg.preventNegativeStock
            ? t("Refused — a sale needs the stock to be there")
            : t("Allowed, costed at the last purchase cost"),
        ],
        [
          "Waste needing a manager",
          t("Above {amount}", { amount: fmtIQD(cfg.wasteApprovalThreshold) }),
        ],
        [
          "Discounts",
          t(
            "A percentage is rounded to the nearest {step} (half-way rounds up); an amount is taken as typed",
            { step: fmtIQD(cfg.discountRoundTo) },
          ),
        ],
        [
          "Discounts a manager approves",
          t(
            "Over {cap}% of the bill: a manager (owner, general or branch manager) approves it on the till with their name and PIN, or gives it themselves. Every discount, void, refund and cancelled bill takes a reason from the list",
            { cap: cfg.discountCapPercent },
          ),
        ],
        [
          "Bill numbers",
          t(
            "{prefix}-{year}-0001, -0002 … for a bill entered without the supplier's number: never given twice, never typed in by hand",
            { prefix: cfg.billPrefix, year: today.slice(0, 4) },
          ),
        ],
      ]
    : [];

  return (
    <div className="grid" style={{ gap: 16 }}>
      <h1 style={{ margin: 0 }}>{t("nav.settings")}</h1>

      <div className="card" data-testid="settings-languages">
        <h3 style={{ marginTop: 0 }}>{t("Languages")}</h3>
        <p className="muted" style={{ fontSize: ".85rem", marginTop: 0 }}>
          {t(
            "Every screen is in English, Arabic and Kurdish. Add another language, or give any phrase the café's own words.",
          )}
        </p>
        <Link href="/settings/languages">{t("Open Languages →")}</Link>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>{t("People")}</h3>
        <p className="muted" style={{ fontSize: ".85rem", marginTop: 0 }}>
          {t(
            "Add a person with their email and role. They then open this app, choose “First time here?”, and create their login with that same email; once they confirm it, they are in — with exactly what their role allows. Deactivating someone takes effect on their very next click.",
          )}
        </p>
        <PeopleManager
          members={members}
          myId={profile.id}
          isOwner={profile.roles.includes("owner")}
        />
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>{t("Business configuration")}</h3>
        <table>
          <tbody>
            {config.map(([k, v]) => (
              <tr key={k}>
                <td className="muted">{t(k)}</td>
                <td>{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="muted" style={{ fontSize: ".8rem" }}>
          {t("These are changed in the database by the owner; there is no screen for them yet.")}
        </p>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>{t("Alerts")}</h3>
        <p className="muted" style={{ fontSize: ".85rem", marginTop: 0 }}>
          {t(
            "The dashboard checks the books against these each time it opens, and says what needs someone: red now, orange soon. Leave a box empty to follow its default. How long a supplier takes to deliver is set on each vendor (Vendors → Edit); this is for the rest.",
          )}
        </p>
        <AlertThresholds thresholds={thresholds} />
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>{t("Locations")}</h3>
        <table>
          <tbody>
            {locations.map((l) => (
              <tr key={l.id}>
                <td>{l.name}</td>
                <td className="muted">{t(KIND_LABEL[l.kind] ?? l.kind)}</td>
                <td className="muted">{l.isActive ? t("active") : t("inactive")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {has(profile, "settings.manage") && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>{t("Roles & what they may do")}</h3>
          <p className="muted" style={{ fontSize: ".85rem", marginTop: 0 }}>
            {t(
              "Enforced by the database on every read and write — the screens only follow it. A cashier sells but never sees a cost; a counter never sees what the ledger expects; a count is approved by someone other than its counter; only the owner reopens a locked period.",
            )}
          </p>
          <div
            className="grid"
            style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px,1fr))" }}
          >
            {(Object.keys(ROLE_PERMISSIONS) as Role[]).map((role) => (
              <div
                key={role}
                style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 12 }}
              >
                <strong>{t(roleLabel(role))}</strong>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 8 }}>
                  {[...ROLE_PERMISSIONS[role]].map((p) => (
                    <span key={p} className="badge" translate="no" style={{ fontSize: ".72rem" }}>
                      {p}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
