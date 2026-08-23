import { ModulePlaceholder } from "@/components/ModulePlaceholder";

export default function Page() {
  return (
    <ModulePlaceholder
      titleKey="nav.count"
      phase="Phase 1"
      done={[
        "stock_count schema (blind counts, save/resume, approval)",
        "computeCountVariance() + adjustment posting (tested)",
      ]}
      planned={["Mobile counting flow, barcode scan, variance approval queue"]}
    />
  );
}
