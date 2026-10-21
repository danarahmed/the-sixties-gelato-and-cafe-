import { getT } from "@/lib/i18n/server";
import { has, requirePermission } from "@/lib/auth/session";
import { getCustomers } from "@/lib/db/customers";
import { CustomersList } from "@/components/customers/CustomersList";
import { AccountsList } from "@/components/customers/AccountsList";
import { getCustomerAccounts } from "@/lib/db/accounts";
import { PageIntro } from "@/components/PageIntro";

export const dynamic = "force-dynamic";

/**
 * The café's customers (0050): found at the till by their number, earning a
 * point for every so many dinars they pay, and taking rewards off a bill.
 */
export default async function CustomersPage() {
  const profile = await requirePermission("customer.view");
  const t = await getT();
  const [customers, accounts] = await Promise.all([getCustomers(), getCustomerAccounts()]);

  return (
    <div className="grid" style={{ gap: 16 }}>
      <h1 style={{ margin: 0 }}>{t("nav.customers")}</h1>
      <PageIntro
        text={t(
          "Who buys from the café, found at the till by their phone number. Each earns points on what they pay, and takes a reward off a bill once they have enough (the rules are on Settings).",
        )}
        more={t("How this works")}
      />
      {accounts && <AccountsList rows={accounts.rows} books={accounts.books} t={t} />}
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
