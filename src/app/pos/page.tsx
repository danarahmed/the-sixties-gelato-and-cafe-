import Link from "next/link";
import { getT } from "@/lib/i18n/server";
import { has, requirePermission } from "@/lib/auth/session";
import { getOpenBills, getPosAddons, getPosCatalogue, getTables } from "@/lib/db/pos";
import { getChannels } from "@/lib/db/channels";
import { getDrawerState } from "@/lib/db/cash";
import { getFxStatus } from "@/lib/db/fx";
import { PosClient } from "@/components/pos/PosClient";
import { ChannelsProvider } from "@/components/ChannelsProvider";
import { EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function PosPage() {
  const profile = await requirePermission("sale.create");
  const t = await getT();
  const [items, addons, tables, bills, channels, drawer, fx] = await Promise.all([
    getPosCatalogue(),
    getPosAddons(),
    getTables(),
    getOpenBills(),
    getChannels(),
    getDrawerState(),
    getFxStatus(),
  ]);

  if (items.length === 0) {
    return (
      <div className="grid" style={{ gap: 16 }}>
        <h1 style={{ margin: 0 }}>{t("pos.title")}</h1>
        <EmptyState title={t("pos.noProducts")} hint={t("pos.noProductsHint")} />
        {has(profile, "recipe.edit") && (
          <p className="muted" style={{ fontSize: ".85rem" }}>
            <Link href="/products">{t("nav.products")}</Link>
          </p>
        )}
      </div>
    );
  }

  return (
    <ChannelsProvider channels={channels}>
      <PosClient
        items={items}
        addons={addons}
        tables={tables}
        initialBills={bills}
        canSeeCost={has(profile, "cost.view")}
        canVoid={has(profile, "sale.void")}
        canManageTables={has(profile, "settings.manage") || has(profile, "day.close")}
        businessName={profile.businessName}
        cashierName={profile.name}
        timezone={profile.timezone}
        canDiscount={has(profile, "discount.apply")}
        canAddCustomer={has(profile, "customer.edit")}
        discountRules={{ cap: profile.discountCap, canApprove: has(profile, "discount.approve") }}
        money={{ decimals: profile.currencyDecimals, discountStep: profile.discountRoundTo }}
        initialDrawer={drawer}
        fx={fx.usable && fx.rate !== null ? { rate: fx.rate, roundTo: fx.roundTo } : null}
        dollarsOffHours={!fx.usable && fx.rate !== null ? fx.ageHours : null}
      />
    </ChannelsProvider>
  );
}
