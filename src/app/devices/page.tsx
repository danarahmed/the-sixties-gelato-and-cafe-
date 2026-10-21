import { getT } from "@/lib/i18n/server";
import { requireMember } from "@/lib/auth/session";
import { getPosCatalogue } from "@/lib/db/pos";
import { getReceiptSetup } from "@/lib/db/receipt";
import { tillChoice } from "@/lib/place";
import { DevicesCheck } from "./DevicesCheck";
import { PageIntro } from "@/components/PageIntro";

export const dynamic = "force-dynamic";

/**
 * Test your devices (G4): before opening, each of the till's devices tried in
 * turn (the internet, the receipt printer and its drawer, the label printer,
 * the scanner, the scale's labels, the phone warnings), each problem said in
 * plain words with what to do.
 */
export default async function DevicesPage() {
  const profile = await requireMember();
  const t = await getT();
  const { at } = await tillChoice().catch(() => ({ at: null }));
  const [items, receipt] = await Promise.all([
    getPosCatalogue(at).catch(() => []),
    // The test receipt prints as the café's own does (0091).
    getReceiptSetup().catch(() => null),
  ]);
  const name = (i: (typeof items)[number]) =>
    i.variantName && i.variantName !== i.productName
      ? `${i.productName} (${i.variantName})`
      : i.productName;
  return (
    <div className="grid" style={{ gap: 16 }}>
      <div>
        <h1 style={{ margin: 0 }}>{t("Test your devices")}</h1>
        <PageIntro
          text={t(
            "Before opening, try each one in turn. Anything that does not work says what to do. Nothing here is a sale or goes in the books.",
          )}
          more={t("How this works")}
        />
      </div>
      <DevicesCheck
        businessName={profile.businessName}
        timezone={profile.timezone}
        receipt={receipt}
        items={items.map((i) => ({
          variantId: i.variantId,
          name: name(i),
          barcode: i.barcode ?? null,
          soldByWeight: i.soldByWeight === true,
        }))}
      />
    </div>
  );
}
