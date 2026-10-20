import { getT } from "@/lib/i18n/server";
import { requireMember } from "@/lib/auth/session";
import { getPosCatalogue } from "@/lib/db/pos";
import { tillChoice } from "@/lib/place";
import { DevicesCheck } from "./DevicesCheck";

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
  const items = await getPosCatalogue(at).catch(() => []);
  const name = (i: (typeof items)[number]) =>
    i.variantName && i.variantName !== i.productName
      ? `${i.productName} (${i.variantName})`
      : i.productName;
  return (
    <div className="grid" style={{ gap: 16 }}>
      <div>
        <h1 style={{ margin: 0 }}>{t("Test your devices")}</h1>
        <p className="muted" style={{ margin: "4px 0 0" }}>
          {t(
            "Before opening, try each one in turn. Anything that does not work says what to do. Nothing here is a sale or goes in the books.",
          )}
        </p>
      </div>
      <DevicesCheck
        businessName={profile.businessName}
        timezone={profile.timezone}
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
