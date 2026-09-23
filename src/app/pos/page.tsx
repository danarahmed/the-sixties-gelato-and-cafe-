import Link from "next/link";
import { getT } from "@/lib/i18n/server";
import { has, requirePermission } from "@/lib/auth/session";
import { getPosCatalogue } from "@/lib/db/reports";
import { PosClient } from "@/components/PosClient";
import { EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function PosPage() {
  const profile = await requirePermission("sale.create");
  const t = await getT();
  const items = await getPosCatalogue();

  return (
    <div className="grid" style={{ gap: 16 }}>
      <h1 style={{ margin: 0 }}>{t("pos.title")}</h1>
      {items.length === 0 ? (
        <EmptyState title={t("pos.noProducts")} hint={t("pos.noProductsHint")} />
      ) : (
        <PosClient items={items} canSeeCost={has(profile, "cost.view")} />
      )}
      {has(profile, "recipe.edit") && (
        <p className="muted" style={{ fontSize: ".85rem" }}>
          <Link href="/products">{t("nav.products")}</Link>
        </p>
      )}
    </div>
  );
}
