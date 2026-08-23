import { ModulePlaceholder } from "@/components/ModulePlaceholder";

export default function Page() {
  return (
    <ModulePlaceholder
      titleKey="nav.reports"
      phase="Phase 2"
      done={["All underlying data captured (sales, COGS snapshots, channels)"]}
      planned={["Menu engineering, channel margin, actual-vs-theoretical usage, exports"]}
    />
  );
}
