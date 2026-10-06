import Link from "next/link";
import { cookies } from "next/headers";
import { getT } from "@/lib/i18n/server";
import { has, requirePermission } from "@/lib/auth/session";
import { getOpenBills, getPosAddons, getPosCatalogue, getTables } from "@/lib/db/pos";
import { getChannels } from "@/lib/db/channels";
import { getDrawerState } from "@/lib/db/cash";
import { getFxStatus } from "@/lib/db/fx";
import { PosClient } from "@/components/pos/PosClient";
import { ChannelsProvider } from "@/components/ChannelsProvider";
import { EmptyState } from "@/components/ui";
import { BranchPicker, PlaceSwitch } from "@/components/PlaceSwitch";
import { getPlace, tillChoice } from "@/lib/place";
import { getScreenCheck } from "@/lib/db/clock";

export const dynamic = "force-dynamic";

export default async function PosPage() {
  const profile = await requirePermission("sale.create");
  const t = await getT();
  // The till sells at its branch (0055): the device's place when it is a
  // branch, the café's only branch when there is one. A device at the central
  // kitchen, with more than one branch to sell at, is asked which.
  const { branches, branch, at } = await tillChoice();
  if (!branch) {
    const place = await getPlace();
    return (
      <div className="grid" style={{ gap: 16 }} data-testid="till-no-branch">
        <h1 style={{ margin: 0 }}>{t("pos.title")}</h1>
        <EmptyState
          title={t("{place} does not sell: the till is at a branch", {
            place: place?.name ?? t("This place"),
          })}
          hint={branches.length > 0 ? t("Choose the branch this till is at.") : undefined}
        />
        {branches.length > 0 && <BranchPicker branches={branches} />}
      </div>
    );
  }
  // The view this device was left on: Tables or the menu.
  const startView = (await cookies()).get("pos_view")?.value;
  const [items, addons, tables, bills, channels, drawer, fx, clockScreen] = await Promise.all([
    getPosCatalogue(at),
    getPosAddons(at),
    getTables(at),
    getOpenBills(at),
    getChannels(),
    getDrawerState(at),
    getFxStatus(),
    getScreenCheck(),
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
      {branches.length > 1 && (
        <div className="till-at" data-testid="till-at">
          <PlaceSwitch places={branches} current={branch.id} kind="till" />
        </div>
      )}
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
        startView={startView === "floor" || startView === "menu" ? startView : null}
        clockScreen={clockScreen}
      />
    </ChannelsProvider>
  );
}
