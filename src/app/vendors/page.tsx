import { getT } from "@/lib/i18n/server";
import { getVendors, getOpenBills, ageBills } from "@/lib/db/books";
import { getBusinessConfig } from "@/lib/db/read";
import { fmtIQD } from "@/lib/format";
import { VendorsClient } from "@/components/books/VendorsClient";

export const dynamic = "force-dynamic";

export default async function VendorsPage() {
  const t = await getT();
  const [vendors, bills, cfg] = await Promise.all([
    getVendors().catch(() => []),
    getOpenBills().catch(() => []),
    getBusinessConfig().catch(() => null),
  ]);
  const ageing = ageBills(bills);

  return (
    <div className="grid" style={{ gap: 18 }}>
      <div className="phead">
        <h1>{t("nav.vendors")}</h1>
        <span className="sc">Suppliers the shop buys from</span>
        <div className="sp">
          <span className={`badge ${ageing.d1_15 + ageing.d16_30 + ageing.d31plus > 0 ? "err" : "ok"}`}>
            {fmtIQD(ageing.total)} payable
          </span>
        </div>
      </div>

      <div className="cards2">
        <div>
          <div className="sc">Not yet due</div>
          <div className="v">{fmtIQD(ageing.current)}</div>
          <div className="m">Within terms</div>
        </div>
        <div>
          <div className="sc">1 – 15 days over</div>
          <div className="v" style={{ color: ageing.d1_15 ? "var(--warn)" : undefined }}>
            {fmtIQD(ageing.d1_15)}
          </div>
          <div className="m">Chase this week</div>
        </div>
        <div>
          <div className="sc">16 – 30 days over</div>
          <div className="v" style={{ color: ageing.d16_30 ? "var(--err)" : undefined }}>
            {fmtIQD(ageing.d16_30)}
          </div>
          <div className="m">Late</div>
        </div>
        <div>
          <div className="sc">Over 30 days</div>
          <div className="v" style={{ color: ageing.d31plus ? "var(--err)" : undefined }}>
            {fmtIQD(ageing.d31plus)}
          </div>
          <div className="m">Relationship at risk</div>
        </div>
      </div>

      <VendorsClient
        vendors={vendors}
        bills={bills.map((b) => ({
          id: b.id,
          supplierId: b.supplierId,
          invoiceNo: b.invoiceNo,
          invoiceDate: b.invoiceDate,
          dueDate: b.dueDate,
          total: b.total,
          paid: b.paid,
          outstanding: b.outstanding,
          daysOverdue: b.daysOverdue,
        }))}
        businessName={cfg?.name ?? "The Sixty's Gelato & Café"}
      />

      <p className="muted" style={{ fontSize: ".76rem", lineHeight: 1.7, maxWidth: 760 }}>
        A bill raises what you owe (<strong>Dr Inventory / Cr Accounts payable</strong>) and starts
        the clock on its terms; a payment settles it (<strong>Dr Accounts payable / Cr Cash</strong>).
        Ageing above tells you what to pay first. Goods received on the{" "}
        <strong>Purchasing</strong> screen carry their landed cost into the weighted-average cost
        every recipe is priced from.
      </p>
    </div>
  );
}
