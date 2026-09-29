import Link from "next/link";
import { getT } from "@/lib/i18n/server";
import { has, requirePermission } from "@/lib/auth/session";
import { getItems, getSuppliers } from "@/lib/db/read";
import { getBuyingList } from "@/lib/db/buying";
import { BuyingListForm } from "@/components/purchasing/BuyingList";
import { PlaceSwitch } from "@/components/PlaceSwitch";
import { placeChoice } from "@/lib/place";

export const dynamic = "force-dynamic";

/**
 * What to buy (0045, release T): for each item bought, what is on hand and
 * coming, its use and its levels, and so how much to order, from whom, at
 * what price, and why. The lines chosen become a draft order for each
 * supplier, for a manager to approve on Purchasing.
 */
export default async function BuyingListPage() {
  const profile = await requirePermission("cost.view");
  const t = await getT();
  // What this device's place needs (AB): the orders are for it.
  const { places, place, at } = await placeChoice();
  const [list, items, suppliers] = await Promise.all([
    getBuyingList(at),
    getItems(),
    getSuppliers(),
  ]);
  const units = Object.fromEntries(items.map((i) => [i.id, i.units]));
  return (
    <div className="grid" style={{ gap: 16 }} data-testid="buying-page">
      <div className="phead">
        <h1>{t("What to buy")}</h1>
        <PlaceSwitch places={places} current={place?.id ?? null} />
        <span className="sc">
          {t("{place} · {day} · use judged over the last {days} days", {
            place: list.location,
            day: list.asOf,
            days: list.windowDays,
          })}
        </span>
        <div className="sp">
          <Link href="/purchasing">{t("Back to Purchasing")}</Link>
        </div>
      </div>
      <p className="muted" style={{ margin: 0, fontSize: ".88rem" }}>
        {t(
          "An item is to order when what it has on hand, on order and in draft orders is below its reorder level: its own, set on the item, or its use a day over the last 28 days for the days a delivery takes, and a day more. It is ordered up to its par level, or the reorder level and a week of use, in whole packs, from its usual supplier or the one its last delivery came from. Tick what to order, change what needs changing, and create the orders: a draft for each supplier, for a manager to approve.",
        )}
      </p>
      <BuyingListForm
        list={list}
        units={units}
        suppliers={suppliers.map((s) => ({ id: s.id, name: s.name }))}
        canCreate={has(profile, "purchase.create")}
      />
    </div>
  );
}
