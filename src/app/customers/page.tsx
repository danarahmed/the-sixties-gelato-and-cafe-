import { getT } from "@/lib/i18n/server";
import { has, requirePermission } from "@/lib/auth/session";
import { getCustomers } from "@/lib/db/customers";
import { CustomersList } from "@/components/customers/CustomersList";

export const dynamic = "force-dynamic";

/**
 * The café's customers (0050): found at the till by their number, earning a
 * point for every so many dinars they pay, and taking rewards off a bill.
 */
export default async function CustomersPage() {
  const profile = await requirePermission("customer.view");
  const t = await getT();
  const customers = await getCustomers();

  return (
    <div className="grid" style={{ gap: 16 }}>
      <h1 style={{ margin: 0 }}>{t("nav.customers")}</h1>
      <p className="muted" style={{ marginTop: 0, fontSize: ".9rem" }}>
        {t(
          "Who buys from the café, found at the till by their phone number. Each earns points on what they pay, and takes a reward off a bill once they have enough (the rules are on Settings).",
        )}
      </p>
      <section className="card">
        <CustomersList
          customers={customers}
          timezone={profile.timezone}
          canEdit={has(profile, "customer.edit")}
        />
      </section>
    </div>
  );
}
