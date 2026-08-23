import { ModulePlaceholder } from "@/components/ModulePlaceholder";

export default function Page() {
  return (
    <ModulePlaceholder
      titleKey="nav.orders"
      phase="Phase 1"
      done={[
        "sales_order / lines / tenders schema (append-only, void/refund)",
        "Idempotency + financial-immutability enforced in DB",
      ]}
      planned={["Order list, filters, receipt view, void/refund with reason + approval"]}
    />
  );
}
