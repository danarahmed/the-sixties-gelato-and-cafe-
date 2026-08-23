import { ModulePlaceholder } from "@/components/ModulePlaceholder";

export default function Page() {
  return (
    <ModulePlaceholder
      titleKey="nav.accounting"
      phase="Phase 2"
      done={["Double-entry gl_account / journal_entry / journal_line schema","Balanced-entry + period-lock enforced in DB (tested)"]}
      planned={["Chart of accounts, P&L, journal browser, period close, exports"]}
    />
  );
}
