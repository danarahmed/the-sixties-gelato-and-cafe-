import { requirePermission } from "@/lib/auth/session";
import { CustomerScreen } from "@/components/pos/CustomerScreen";

export const dynamic = "force-dynamic";

/** The customer's screen (plan 11, item 4), opened from the till on a second screen. */
export default async function CustomerScreenPage() {
  const profile = await requirePermission("sale.create");
  return <CustomerScreen business={profile.businessName} />;
}
