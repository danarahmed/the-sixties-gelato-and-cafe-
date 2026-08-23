import { getT } from "@/lib/i18n/server";
import { ROLE_PERMISSIONS, type Role } from "@domain/auth/permissions.js";
import { getBusinessConfig, getLocations } from "@/lib/db/read";

export const dynamic = "force-dynamic";

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

const KIND_LABEL: Record<string, string> = {
  branch: "Branch",
  central_kitchen: "Central kitchen",
  warehouse: "Warehouse",
};

export default async function SettingsPage() {
  const t = await getT();
  const [cfg, locations] = await Promise.all([
    getBusinessConfig().catch(() => null),
    getLocations().catch(() => []),
  ]);

  const config: [string, string][] = cfg
    ? [
        ["Business name", cfg.name],
        ["Currency", `${cfg.currencyCode} — ${cfg.currencyDecimals} decimal places`],
        ["Timezone", `${cfg.timezone} (stored UTC, shown local)`],
        ["Default language", cfg.defaultLocale],
        ["Negative-stock policy", cfg.preventNegativeStock ? "Prevent" : "Warn"],
      ]
    : [];

  return (
    <div className="grid" style={{ gap: 16 }}>
      <div className="badge ok" style={{ alignSelf: "start" }}>🟢 Live database</div>
      <h1 style={{ margin: 0 }}>{t("nav.settings")}</h1>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Business configuration</h3>
        {cfg ? (
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
        ) : (
          <p className="muted">Database not configured.</p>
        )}
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Locations (multi-branch ready)</h3>
        <table>
          <tbody>
            {locations.map((l) => (
              <tr key={l.id}>
                <td>{l.name}</td>
                <td className="muted">{KIND_LABEL[l.kind] ?? l.kind}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Roles &amp; permissions (least privilege)</h3>
        <p className="muted" style={{ fontSize: ".85rem", marginTop: 0 }}>
          This is the tested permission policy. Cashiers can sell but not change costs; counters
          can&apos;t see expected quantities; only accountants lock periods. Login (per-user access
          scoped by Row-Level Security) is the next increment.
        </p>
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px,1fr))" }}>
          {(Object.keys(ROLE_PERMISSIONS) as Role[]).map((role) => (
            <div key={role} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 12 }}>
              <strong>{ROLE_LABEL[role]}</strong>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 8 }}>
                {[...ROLE_PERMISSIONS[role]].slice(0, 40).map((p) => (
                  <span key={p} className="badge" style={{ fontSize: ".72rem" }}>{p}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
