import { ModulePlaceholder } from "@/components/ModulePlaceholder";

export default function Page() {
  return (
    <ModulePlaceholder
      titleKey="nav.ai"
      phase="Phase 3"
      done={[
        "AI provider abstraction planned; app runs fully without any AI key",
        "ai_insight / ai_interaction_log audit schema (human-approval gated)",
      ]}
      planned={["Forecasting, reorder + production suggestions, anomaly detection, NL Q&A"]}
    />
  );
}
