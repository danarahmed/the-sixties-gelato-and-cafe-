import Link from "next/link";
import { getT } from "@/lib/i18n/server";
import { Rich } from "@/lib/i18n/Rich";
import { has, requirePermission } from "@/lib/auth/session";
import { getItems } from "@/lib/db/read";
import { getStockByPlace, getTransfers } from "@/lib/db/transfers";
import { getCafePlaces, placeChoice } from "@/lib/place";
import { fmtIQD } from "@/lib/format";
import { EmptyState } from "@/components/ui";
import { PlaceSwitch } from "@/components/PlaceSwitch";
import { SendTransfer, TransferBoard } from "@/components/inventory/Transfers";

export const dynamic = "force-dynamic";

/**
 * Stock sent between the café's places (0054, release AB): the branch sends
 * the kitchen what it makes with, the kitchen sends the branch what it made.
 * Each transfer leaves at its cost where it was, is on its way in 1210 Stock in
 * transit, and is received where it went — or cancelled on its way. Someone
 * who works at one place sends from it to any of the café's, receives what
 * comes to it and cancels what it sent (0063).
 */
export default async function TransfersPage() {
  const profile = await requirePermission("cost.view", "stock.transfer");
  const t = await getT();
  const canSend = has(profile, "stock.transfer");
  const [{ places, place }, cafe, transfers, items, stock] = await Promise.all([
    placeChoice(),
    getCafePlaces(),
    getTransfers(100),
    getItems(),
    has(profile, "cost.view") ? getStockByPlace() : Promise.resolve({}),
  ]);
  const inTransit = transfers.filter((x) => x.status === "sent").reduce((s, x) => s + x.value, 0);
  const units = Object.fromEntries(
    items.map((i) => [i.id, Object.fromEntries(i.units.map((u) => [u.code, u.label]))]),
  );

  return (
    <div className="grid" style={{ gap: 16 }} data-testid="transfers-page">
      <div className="phead">
        <h1>{t("Transfers")}</h1>
        <PlaceSwitch places={places} current={place?.id ?? null} />
        <span className="sc" data-testid="in-transit">
          {t("On its way: {value}", { value: fmtIQD(inTransit) })}
        </span>
        <div className="sp">
          <Link href="/inventory">{t("Back to Inventory")}</Link>
        </div>
      </div>
      <p className="muted" style={{ margin: 0, fontSize: ".88rem" }}>
        {t(
          "Stock sent from one of the café's places to another leaves at its cost where it was, is on its way until the other place receives it, and what did not arrive is written off as waste. A batch keeps its use-by at the place it goes to.",
        )}
      </p>
      <details className="booked" data-testid="transfers-booked">
        <summary>{t("How it is booked")}</summary>
        <p className="muted" style={{ margin: "6px 0 0", fontSize: ".85rem" }}>
          <Rich
            text={t(
              "On its way it is held in <b>1210 Stock in transit</b>; what did not arrive goes to <b>5300 Waste & spoilage</b>.",
            )}
          />
        </p>
      </details>

      {cafe.length < 2 ? (
        <EmptyState
          title={t("The café has one place")}
          hint={t(
            "Stock is sent between places once the café has a second one: a branch or the central kitchen.",
          )}
        />
      ) : (
        canSend &&
        place && (
          <SendTransfer
            places={places.map((p) => ({ id: p.id, name: p.name }))}
            destinations={cafe.map((p) => ({ id: p.id, name: p.name }))}
            from={place.id}
            items={items.map((i) => ({
              id: i.id,
              name: i.name,
              baseUnit: i.baseUnit,
              units: i.units,
            }))}
            stock={stock}
          />
        )
      )}

      <TransferBoard
        transfers={transfers}
        units={units}
        canAct={canSend}
        worksAt={profile.worksAt}
        timezone={profile.timezone}
      />
    </div>
  );
}
