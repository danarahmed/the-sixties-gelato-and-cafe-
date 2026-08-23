import { ModulePlaceholder } from "@/components/ModulePlaceholder";

export default function Page() {
  return (
    <ModulePlaceholder
      titleKey="nav.inventory"
      phase="Phase 1"
      done={["Append-only inventory_movement ledger + current_stock view","20 movement types, reversals, lot/expiry, transfers"]}
      planned={["Ledger browser, stock-on-hand board, low-stock/expiry alerts"]}
    />
  );
}
