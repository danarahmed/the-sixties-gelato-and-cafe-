import { getT } from "@/lib/i18n/server";
import { ROLE_PERMISSIONS, type Role } from "@domain/auth/permissions.js";

const ROLE_LABEL: Record<Role, string> = {
  owner: "Owner",
  general_manager: "General manager",
  branch_manager: "Branch manager",
  cashier: "Cashier",
  barista: "Barista / production",
  inventory_counter: "Inventory counter",
  purchasing: "Purchasing",
  accountant: "Accountant",
  auditor: "Read-only auditor",
};

export default async function SettingsPage() {
  const t = await getT();
  const config = [
    ["Business name", "The Sixty's Gelato & Café (demo)"],
    ["Currency", "IQD — 0 decimal places (configurable)"],
    ["Timezone", "Asia/Baghdad (stored UTC, shown local)"],
    ["Languages", "English · العربية · کوردی (full RTL)"],
    ["Units", "Metric"],
    ["Costing method", "Moving weighted-average (FIFO optional)"],
    ["Negative-stock policy", "Warn (configurable to prevent)"],
  ];
  const locations = [
    ["Main Branch", "Branch"],
    ["Central Kitchen", "Central kitchen"],
  ];

  return (
    <div className="grid" style={{ gap: 16 }}>
      <div className="demo-banner">⚠️ {t("common.demo")}</div>
      <h1 style={{ margin: 0 }}>{t("nav.settings")}</h1>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Business configuration</h3>
        <table>
          <tbody>
            {config.map(([k, v]) => (
              <tr key={k}>
                <td className="muted">{k}</td>
                <td>{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Locations (multi-branch ready)</h3>
        <table>
          <tbody>
            {locations.map(([n, kind]) => (
              <tr key={n}>
                <td>{n}</td>
                <td className="muted">{kind}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Roles &amp; permissions (least privilege)</h3>
        <p className="muted" style={{ fontSize: ".85rem", marginTop: 0 }}>
          This is the tested permission policy that drives the UI and is re-checked server-side.
          Cashiers can sell but not change costs; counters can&apos;t see expected quantities; only
          accountants lock periods.
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
              <strong>{ROLE_LABEL[role]}</strong>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 8 }}>
                {[...ROLE_PERMISSIONS[role]].slice(0, 40).map((p) => (
                  <span key={p} className="badge" style={{ fontSize: ".72rem" }}>
                    {p}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>First-time setup (scheduled)</h3>
        <p className="muted" style={{ fontSize: ".9rem" }}>
          A guided wizard (business + branch details, users &amp; roles, MFA, opening balances) is
          the next step once login and the live database are wired.
        </p>
      </div>
    </div>
  );
}
