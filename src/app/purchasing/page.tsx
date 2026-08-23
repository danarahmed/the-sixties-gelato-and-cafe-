import { ModulePlaceholder } from "@/components/ModulePlaceholder";

export default function Page() {
  return (
    <ModulePlaceholder
      titleKey="nav.purchasing"
      phase="Phase 1"
      done={["supplier / purchase_order / goods_receipt schema","Landed-cost + WAC costing (tested), partial deliveries"]}
      planned={["PO builder, receiving screen, supplier price history"]}
    />
  );
}
