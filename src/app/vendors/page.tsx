import { getT } from "@/lib/i18n/server";
import { has, requirePermission } from "@/lib/auth/session";
import { ageBills, getGlAccounts, getNextBillNumber, getVendorBook } from "@/lib/db/books";
import { getReceipts } from "@/lib/db/read";
import { fmtIQD } from "@/lib/format";
import { businessToday } from "@/lib/dates";
import { VendorsClient } from "@/components/books/VendorsClient";
import { getSupplierCredits } from "@/lib/db/purchasing";

export const dynamic = "force-dynamic";

/**
 * Accounts a supplier's credit other than for goods may not be taken off (0044,
 * the database refuses the same): cash, the card's and the bank's, stock, the
 * losses taken from stock (0048), and the advances given on pay (0049).
 * A credit may come off the price variance (5050), which a bill may not.
 */
const NOT_FOR_CREDITS = new Set([
  "1000",
  "1001",
  "1005",
  "1006",
  "1010",
  "1020",
  "1100",
  "1200",
  "1300",
  "5000",
  "5300",
  "5310",
  "5400",
]);

/**
 * Accounts a non-stock bill may not be charged to (the database refuses the
 * same list): cash, in dinars and dollars, the card's and the bank's, stock,
 * the losses taken from stock (0048), and the advances given on pay (0049).
 */
const NOT_FOR_BILLS = new Set([
  "1000",
  "1001",
  "1005",
  "1006",
  "1010",
  "1020",
  "1100",
  "1200",
  "1300",
  "5000",
  "5050",
  "5300",
  "5310",
  "5400",
]);

export default async function VendorsPage() {
  const profile = await requirePermission("cost.view");
  const t = await getT();
  const today = businessToday(profile.timezone);
  const canBill = has(profile, "purchase.create") || has(profile, "accounting.post");
  const [{ vendors, openBills }, receipts, accounts, nextBillNo, credits] = await Promise.all([
    getVendorBook(today),
    getReceipts(200),
    getGlAccounts(),
    canBill ? getNextBillNumber() : Promise.resolve(null),
    getSupplierCredits(),
  ]);
  const ageing = ageBills(openBills);

  return (
    <div className="grid" style={{ gap: 18 }}>
      <div className="phead">
        <h1>{t("nav.vendors")}</h1>
        <span className="sc">{t("Suppliers the shop buys from")}</span>
        <div className="sp">
          <span
            className={`badge ${ageing.d1_15 + ageing.d16_30 + ageing.d31plus > 0 ? "err" : "ok"}`}
          >
            {t("{amount} payable", { amount: fmtIQD(ageing.total) })}
          </span>
        </div>
      </div>

      <div className="cards2">
        <div>
          <div className="sc">{t("Not yet due")}</div>
          <div className="v">{fmtIQD(ageing.current)}</div>
          <div className="m">{t("Within terms")}</div>
        </div>
        <div>
          <div className="sc">{t("1 – 15 days over")}</div>
          <div className="v" style={{ color: ageing.d1_15 ? "var(--warn)" : undefined }}>
            {fmtIQD(ageing.d1_15)}
          </div>
          <div className="m">{t("Chase this week")}</div>
        </div>
        <div>
          <div className="sc">{t("16 – 30 days over")}</div>
          <div className="v" style={{ color: ageing.d16_30 ? "var(--err)" : undefined }}>
            {fmtIQD(ageing.d16_30)}
          </div>
          <div className="m">{t("Late")}</div>
        </div>
        <div>
          <div className="sc">{t("Over 30 days")}</div>
          <div className="v" style={{ color: ageing.d31plus ? "var(--err)" : undefined }}>
            {fmtIQD(ageing.d31plus)}
          </div>
          <div className="m">{t("Relationship at risk")}</div>
        </div>
      </div>

      <VendorsClient
        vendors={vendors}
        bills={openBills}
        receipts={receipts
          .filter((r) => r.billable)
          .map((r) => ({
            id: r.id,
            supplierId: r.supplierId,
            receiptNo: r.receiptNo,
            value: r.value,
            receivedAt: r.receivedAt,
            note: r.note,
          }))}
        accounts={accounts
          .filter(
            (a) =>
              a.isActive &&
              (a.type === "expense" || a.type === "asset") &&
              !NOT_FOR_BILLS.has(a.code),
          )
          .map((a) => ({ code: a.code, name: a.name }))}
        today={today}
        businessName={profile.businessName}
        canBill={canBill}
        nextBillNo={nextBillNo}
        canPay={has(profile, "accounting.post")}
        canAddVendor={has(profile, "purchase.create")}
        credits={credits}
        billedReceipts={receipts
          .filter((r) => r.billed && !r.reversed && !r.legacy)
          .map((r) => ({ id: r.id, receiptNo: r.receiptNo, supplierId: r.supplierId }))}
        creditAccounts={accounts
          .filter(
            (a) =>
              a.isActive &&
              (a.type === "expense" || a.type === "asset") &&
              !NOT_FOR_CREDITS.has(a.code),
          )
          .map((a) => ({ code: a.code, name: a.name }))}
        canCredit={canBill}
      />

      <p className="muted" style={{ fontSize: ".76rem", lineHeight: 1.7, maxWidth: 780 }}>
        {t(
          "A bill for goods is matched to the receipt that brought them in: it clears Goods received not invoiced (2050) for what the receipt recorded, puts any price difference to 5050, and raises Accounts payable (2000). A delivery received before the controls, whose payable the old app posted when the goods arrived, is billed against that payable: only a difference in price is posted. A bill for a service or an asset is charged straight to its account. A payment settles the payable from cash, card or the bank. The same invoice number from the same vendor can only be entered once.",
        )}
      </p>
    </div>
  );
}
