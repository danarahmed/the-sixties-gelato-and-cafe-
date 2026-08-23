import { ModulePlaceholder } from "@/components/ModulePlaceholder";

export default function Page() {
  return (
    <ModulePlaceholder
      titleKey="nav.settings"
      phase="Phase 1"
      done={[
        "Configurable currency/precision, timezone, locale, negative-stock policy (business table)",
        "Role-based permission model (tested)",
      ]}
      planned={["Business + branch setup wizard, user & role management, MFA"]}
    />
  );
}
