import { getT } from "@/lib/i18n/server";
import { has, requirePermission } from "@/lib/auth/session";
import { ROLE_PERMISSIONS, type Role } from "@domain/auth/permissions.js";
import { getBusinessConfig, getLocations } from "@/lib/db/read";
import { getMembers } from "@/lib/db/reports";
import { fmtIQD, roleLabel } from "@/lib/format";
import { PeopleManager } from "@/components/PeopleManager";

export const dynamic = "force-dynamic";

const KIND_LABEL: Record<string, string> = {
  branch: "Branch",
  central_kitchen: "Central kitchen",
  warehouse: "Warehouse",
};

export default async function SettingsPage() {
  const profile = await requirePermission("settings.manage");
  const t = await getT();
  const [cfg, locations, members] = await Promise.all([
    getBusinessConfig(),
    getLocations(),
    getMembers(),
  ]);

  const config: [string, string][] = cfg
    ? [
        ["Business name", cfg.name],
        ["Currency", `${cfg.currencyCode} — ${cfg.currencyDecimals} decimal places`],
        [
          "Timezone",
          `${cfg.timezone} — every trading day and period runs midnight to midnight here`,
        ],
        ["Default language", cfg.defaultLocale],
        [
          "Negative stock",
          cfg.preventNegativeStock
            ? "Refused — a sale needs the stock to be there"
            : "Allowed, costed at the last purchase cost",
        ],
        ["Waste needing a manager", `Above ${fmtIQD(cfg.wasteApprovalThreshold)}`],
      ]
    : [];

  return (
    <div className="grid" style={{ gap: 16 }}>
      <h1 style={{ margin: 0 }}>{t("nav.settings")}</h1>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>People</h3>
        <p className="muted" style={{ fontSize: ".85rem", marginTop: 0 }}>
          Add a person with their email and role. They then open this app, choose “First time
          here?”, and create their login with that same email; once they confirm it, they are in —
          with exactly what their role allows. Deactivating someone takes effect on their very next
          click.
        </p>
        <PeopleManager
          members={members}
          myId={profile.id}
          isOwner={profile.roles.includes("owner")}
        />
      </div>

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
        <p className="muted" style={{ fontSize: ".8rem" }}>
          These are changed in the database by the owner; there is no screen for them yet.
        </p>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Locations</h3>
        <table>
          <tbody>
            {locations.map((l) => (
              <tr key={l.id}>
                <td>{l.name}</td>
                <td className="muted">{KIND_LABEL[l.kind] ?? l.kind}</td>
                <td className="muted">{l.isActive ? "active" : "inactive"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {has(profile, "settings.manage") && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Roles &amp; what they may do</h3>
          <p className="muted" style={{ fontSize: ".85rem", marginTop: 0 }}>
            Enforced by the database on every read and write — the screens only follow it. A cashier
            sells but never sees a cost; a counter never sees what the ledger expects; a count is
            approved by someone other than its counter; only the owner reopens a locked period.
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
                <strong>{roleLabel(role)}</strong>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 8 }}>
                  {[...ROLE_PERMISSIONS[role]].map((p) => (
                    <span key={p} className="badge" style={{ fontSize: ".72rem" }}>
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
