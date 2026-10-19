import Link from "next/link";
import { getT } from "@/lib/i18n/server";
import { requirePermission } from "@/lib/auth/session";
import { getPosCatalogue } from "@/lib/db/pos";
import { EmptyState } from "@/components/ui";
import { LabelSheet } from "./LabelSheet";

export const dynamic = "force-dynamic";

/**
 * Labels with barcodes (round twenty, 0078): for each size that has a barcode,
 * as many labels as wanted — its name, its take-away price and its barcode —
 * printed on the label printer or on a sheet.
 */
export default async function LabelsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const profile = await requirePermission("recipe.edit", "production.record");
  const t = await getT();
  const sp = await searchParams;
  const only = typeof sp.size === "string" ? sp.size : null;
  const items = (await getPosCatalogue()).filter((i) => i.barcode);
  return (
    <div className="grid" style={{ gap: 16 }}>
      <Link href="/products" className="muted no-print">
        {t("← Products & Recipes")}
      </Link>
      <h1 style={{ margin: 0 }} className="no-print">
        {t("Labels")}
      </h1>
      {items.length === 0 ? (
        <EmptyState
          title={t("No size has a barcode yet")}
          hint={t("Give a size its barcode on Products & Recipes, under Sizes & prices.")}
        />
      ) : (
        <LabelSheet
          businessName={profile.businessName}
          items={items.map((i) => ({
            variantId: i.variantId,
            name:
              i.variantName && i.variantName !== i.productName
                ? `${i.productName} (${i.variantName})`
                : i.productName,
            price: i.prices.takeaway ?? i.prices.dine_in ?? null,
            barcode: i.barcode!,
            weighed: i.soldByWeight === true,
          }))}
          only={only}
        />
      )}
    </div>
  );
}
