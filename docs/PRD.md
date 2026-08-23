# Product Requirements Document

## 1. Product

A single, reliable source of truth for running The Sixty's Gelato & Café:
sales & payments, product/recipe costs, inventory quantities and values,
production batches, purchases & suppliers, waste & variances, delivery-platform
sales & settlements, expenses/revenue/profit, and AI-generated forecasts and
alerts. Delivered as an installable, offline-capable PWA.

## 2. Users & roles

Owner, General Manager, Branch Manager, Cashier, Barista/Production, Inventory
Counter, Purchasing, Accountant, Read-only Auditor. Least-privilege: e.g.
cashiers create sales but cannot change recipe costs; counters enter blind
counts; managers approve adjustments/waste/refunds within limits; only
authorized accountants lock/reopen periods. Sensitive cost/profit/payroll/AI
data is hidden from most staff. Every action is written to an immutable audit
log (who, what, when, device, reason).

## 3. Core principles (non-negotiable)

1. **Inventory integrity:** current stock is derived from an append-only
   movement ledger; there is no editable stock field. Every consumable counts.
2. **Exact arithmetic:** decimal money & quantities; no floating point in
   accounting.
3. **Append-only financials:** sales and inventory movements are never edited;
   corrections are reversals/adjustments with reason and permission.
4. **Historical accuracy:** cost snapshots at transaction time; later price
   changes don't rewrite past profitability.
5. **Offline-safe:** offline transactions carry UUID idempotency keys and sync
   exactly once. No silent last-write-wins.
6. **Truthful profit:** gross sales, net sales, theoretical cost, gross profit,
   channel contribution, and allocated profit are shown _separately_.
7. **AI assists, never decides:** AI recommends; humans approve; app code owns
   all money/inventory math.

## 4. Functional scope

- **Catalog & recipes:** products, variants/sizes/flavours/modifiers;
  ingredients, packaging, consumables, finished goods, resale; nested
  sub-recipes; recipe versioning with effective dates; different recipes by size
  and packaging by channel; allergens, images, instructions.
- **Costing:** purchase cost, moving weighted-average (default), optional FIFO
  where appropriate, recipe cost per batch & per serving, packaging cost,
  theoretical & actual COGS, margins, contribution by product/channel, cost
  snapshots, landed-cost allocation (freight/rebates/discounts).
- **Inventory:** 20 movement types; item+qty+unit+location+cost+lot+expiry+
  reference+employee+timestamp+reason+approval per movement; purchase vs
  consumption units; locations (branch, warehouse, central kitchen); transfers;
  suppliers/POs/receiving/invoices/partial deliveries; lot & expiry tracking;
  min/max/safety/par; low-stock, expiry, and negative-stock handling; barcode/QR.
- **Production:** batches consuming raw materials & sub-recipes, planned vs
  actual yield, variance, traceable finished-goods lots, atomic inventory
  update; production-planning recommendations.
- **Counting:** full/cycle/category/location/high-value/blind counts;
  save/resume; multiple counters; recount; variance thresholds & approval;
  package-to-base conversion; expected vs counted vs value variance.
- **POS:** touch-friendly; categories/favourites/search; sizes/modifiers/add-ons;
  dine-in/takeaway/direct-delivery/platform; cash/card/platform/mixed tenders;
  discounts/comps with reason & limits; suspended orders; refunds/voids;
  receipts; cash drawer & shift close with variance; offline selling.
- **Delivery platforms:** generic layer (Talabat + future); direct web; CSV
  import; API/webhook adapters where available; internal↔external mappings;
  full economic breakdown per order; settlement reconciliation; per-channel/
  branch/period/promotion pricing.
- **Accounting:** double-entry ledger; auto-posting from sales/COGS/purchases/
  fees/settlements/adjustments; configurable chart of accounts; periods &
  locking; reversals; supplier/platform balances; P&L; inventory valuation;
  CSV/Excel/PDF export.
- **Reports & dashboards:** owner dashboard + product mix, menu engineering,
  margins, discount/promotion profitability, sales-vs-forecast,
  actual-vs-theoretical usage & food cost, waste, variance, purchase-price
  changes, supplier performance, inventory movement/valuation/ageing/expiry,
  production yield, platform reconciliation, cashier/shift reconciliation. All
  filterable, drillable, exportable.
- **AI insights:** forecasting, purchase/par/production suggestions, expiry/
  overstock/understock risk, waste prediction, variance & fraud anomaly
  detection, supplier price-change & settlement anomaly detection, menu/pricing
  scenarios, natural-language Q&A. Each insight shows recommendation,
  explanation, data used, confidence, horizon, impact, suggested action, and an
  approval control. Full AI audit trail. Human approval required before any
  write (PO, price, recipe, inventory, journal, promotion, supplier contact).

## 5. Non-functional

Cross-platform PWA (Windows Edge/Chrome, iOS Safari, Android Chrome);
responsive; accessible (contrast, keyboard, large tap targets); light/dark;
EN/AR/CKB with RTL; fast under load; offline with visible sync state; OWASP
security; RLS; server-side validation; secret management; audit logging;
automated backups with tested restore; error monitoring; health checks.

## 6. Out of scope (for now)

Tax rules/calculation. Payment-card storage (use provider tokens if online
payment is added later).

## 7. Acceptance criteria

The 12 scenarios in `docs/TEST_PLAN.md` (all currently automated and passing).
