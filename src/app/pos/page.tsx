import Link from "next/link";
import { getT } from "@/lib/i18n/server";
import { loadCatalog } from "@/lib/db/catalog";
import { PosClient } from "@/components/PosClient";
import { EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function PosPage() {
  const t = await getT();
  const cat = await loadCatalog().catch(() => null);
  const variants = cat?.variants ?? [];

  return (
    <div className="grid" style={{ gap: 16 }}>
      <div className="badge ok" style={{ alignSelf: "start" }}>
        🟢 Live — sales post real orders + ledger movements + journal
      </div>
      <h1 style={{ margin: 0 }}>{t("pos.title")}</h1>

      {variants.length === 0 ? (
        <EmptyState
          title="No products to sell yet"
          hint="Create a product (with a recipe and channel prices) on the Products screen, then it appears here."
        />
      ) : (
        <PosClient
          variants={variants.map((v) => ({
            variantId: v.variantId,
            productName: v.productName,
            variantName: v.variantName,
            priceByChannel: v.priceByChannel,
            cogsByChannel: v.cogsByChannel,
          }))}
        />
      )}

      <p className="muted" style={{ fontSize: ".85rem" }}>
        Need products? Go to <Link href="/products">Products</Link>. Watch cost and margin change with
        the channel — packaging is deducted only on the channels its recipe line targets.
      </p>
    </div>
  );
}
