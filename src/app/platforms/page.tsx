import { ModulePlaceholder } from "@/components/ModulePlaceholder";

export default function Page() {
  return (
    <ModulePlaceholder
      titleKey="nav.platforms"
      phase="Phase 2"
      done={[
        "Generic platform_order schema (all settlement components stored separately)",
        "Payout + contribution + settlement reconciliation (tested)",
        "Natural-key idempotency prevents duplicate imports",
      ]}
      planned={["CSV import, mock Talabat adapter, reconciliation workbench"]}
    />
  );
}
