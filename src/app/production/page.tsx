import { ModulePlaceholder } from "@/components/ModulePlaceholder";

export default function Page() {
  return (
    <ModulePlaceholder
      titleKey="nav.production"
      phase="Phase 1"
      done={["production_batch schema + planProductionBatch() yield/variance (tested)","Finished-goods valuation at actual yield"]}
      planned={["Batch entry screen, production planning recommendations"]}
    />
  );
}
