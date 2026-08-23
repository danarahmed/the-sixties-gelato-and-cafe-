# The Sixty's Gelato & Café — Full Walkthrough & Feature Tutorial

> **⚠️ 2026-08-23 update — the app is now LIVE and EMPTY.** All demonstration
> data has been removed and every screen now reads and writes the real Supabase
> database. The example numbers quoted below (9,979 straws, Iced Latte, etc.) no
> longer exist — they illustrate what each screen _shows once you enter your own
> data_. Start by adding stock on **Inventory**, a menu on **Products**, a
> purchase on **Purchasing**, then sell on **POS**. "🔜 After DB wiring" notes
> below that concern basic reads/writes are now done; remaining items (login,
> settlement CSV import, production batch entry, exports) are noted in
> `PROGRESS.md`.

A complete, screen-by-screen tutorial of the application **as it exists today**.
Every feature is mapped to its **exact UI location** — the sidebar label and the
page address (URL path) — and to the specific buttons, fields, and tables on that
screen.

- **Live app:** https://sixties-gelato-cafe.vercel.app
- **Status legend used below:**
  - ✅ **Live now** — you can click it today (runs on demonstration data).
  - 🔜 **After DB wiring** — the screen/field is designed and the logic is tested,
    but it becomes real once login + the database are connected.
- Everything is labelled **Demonstration data**. All prices/costs are examples.

> How to read a "location": **Sidebar → _Label_** is the menu item on the left;
> **`/path`** is what you can type after the site address (e.g.
> `https://sixties-gelato-cafe.vercel.app/pos`).

---

## Table of contents

1. [The global frame (top bar, sidebar, language, theme, offline)](#1-the-global-frame)
2. [Core concepts you'll see everywhere](#2-core-concepts)
3. [Dashboard](#3-dashboard) · `/dashboard`
4. [POS (Point of Sale)](#4-pos) · `/pos`
5. [Orders](#5-orders) · `/orders`
6. [Products & Recipes](#6-products--recipes) · `/products`
7. [Production](#7-production) · `/production`
8. [Inventory](#8-inventory) · `/inventory`
9. [Stock Count](#9-stock-count) · `/count`
10. [Purchasing](#10-purchasing) · `/purchasing`
11. [Delivery Platforms](#11-delivery-platforms) · `/platforms`
12. [Accounting](#12-accounting) · `/accounting`
13. [Reports](#13-reports) · `/reports`
14. [AI Insights](#14-ai-insights) · `/ai`
15. [Settings](#15-settings) · `/settings`
16. [Feature index (every feature → where it lives)](#16-feature-index)

---

## 1. The global frame

These appear on **every** screen.

**Top bar (across the top):**

- **☰ (menu icon)** — _(phones/tablets)_ opens/closes the sidebar. On a wide
  screen the sidebar is always visible so this does nothing visible. ✅
- **🍨 The Sixty's Gelato & Café** — the app name/brand. ✅
- **🟢 Online / 🟠 Offline** — connection indicator. Shows Online normally; if the
  internet drops it flips to Offline, and (once selling is wired) sales queue on
  the device and sync when you reconnect. ✅ (indicator) / 🔜 (queue)
- **Language dropdown** — choose **English**, **العربية** (Arabic), or **کوردی**
  (Kurdish). Arabic and Kurdish switch the **entire layout to right-to-left**. ✅
- **☀️ / 🌙 (theme button)** — toggle **light/dark** mode. Your choice is
  remembered. ✅

**Sidebar (down the left, right on RTL):** the 13 modules — Dashboard, POS,
Orders, Products & Recipes, Production, Inventory, Stock Count, Purchasing,
Delivery Platforms, Accounting, Reports, AI Insights, Settings. The current page
is highlighted. ✅

**Demo banner** — the yellow ⚠️ strip at the top of each page reminding you the
numbers are examples. ✅

---

## 2. Core concepts

Understanding these five ideas makes every screen obvious.

- **Channel** = _how_ an order is fulfilled: **Dine-in, Takeaway, Direct
  delivery, Talabat**. The channel decides which packaging is used and which
  price applies. You'll pick it on the POS.
- **Base unit** = the smallest unit an item is tracked in (a straw in _each_,
  milk in _ml_, coffee in _g_). You **buy** in bigger units (carton, case, kg)
  and the system converts down to the base unit automatically.
- **The inventory ledger is append-only.** There is no "type the new stock here"
  box. Current stock is always the sum of every movement (receipts, sales,
  production, waste, counts). Mistakes are fixed with a **reversal/adjustment**,
  never an edit — so history is always intact.
- **Profit is several numbers, not one.** You'll see _gross sales → net sales →
  gross profit → contribution profit_. Each strips away a different cost, so you
  see the truth after discounts and platform fees.
- **Roles** decide who can do what (a cashier can sell but not change costs; a
  manager approves adjustments). See Settings.

---

## 3. Dashboard

**Location:** Sidebar → **Dashboard** · `/dashboard` · ✅ Live now

Your at-a-glance morning screen. What's on it:

**KPI cards (top row):**

- **Net sales today** — total sales value of today's orders (demo: from 5 sample
  orders).
- **Gross profit** — net sales minus product cost (COGS).
- **Contribution profit (Talabat)** — profit on the Talabat order _after_ platform
  commission and fees (the honest delivery number).
- **Orders** — how many orders today.
- **Average order value** — net sales ÷ orders.
- **Expected platform payout** — what Talabat should actually pay you (not what
  the customer paid).

**Three alert cards (below):**

- **Low-stock items** — anything below its reorder point, shown as
  `on-hand / reorder` (demo: Delivery bag 420/500, Drink carrier 470/500).
- **Expiring soon** — items within 3 days of expiry, with the date (demo:
  Pistachio gelato 2026-08-20, Milk 2026-08-25).
- **Talabat reconciliation** — settlement problems needing attention, with the
  money impact.

**Try it:** just read it. Then click into **POS** to create activity.

**🔜 After DB wiring:** these numbers come from your real sales/stock instead of
the sample set, and each card becomes click-through to the underlying list.

---

## 4. POS

**Location:** Sidebar → **POS** · `/pos` · ✅ Live now (the flagship demo)

A touch-friendly till. This is where the channel-aware engine is most visible.

**Step-by-step:**

1. **Pick a channel** — the tab row near the top: **Dine-in / Takeaway / Direct
   delivery / Talabat**. This is the single most important choice — it changes
   prices _and_ packaging.
2. **Add products** — tap a tile under **Select a product** (demo: _Iced Latte
   (Medium)_, _Gelato Cup — Pistachio_). Each tile shows the price **for the
   chosen channel**. Tapping adds it to the cart.
3. **Adjust the cart** (right panel) — use **−** / **+** to change quantities;
   a line drops off at zero. **Clear** empties the cart.
4. **Read the live totals** — as you change the cart or channel, these recompute
   instantly:
   - **Price** — what the customer pays.
   - **Theoretical cost** — the recipe/packaging cost (COGS).
   - **Gross margin** — Price − Cost, with the **margin %**.
5. **Complete the sale** — **💵 Cash** or **💳 Card**. You get a **receipt block**:
   a sale number, the tender, channel, net and margin, and an expandable
   **"Inventory movements this sale posts"** list — the exact stock that would be
   deducted.
6. **Bottom table — "Inventory this sale will deduct — _channel_"** — the merged
   list of every item + base-unit quantity + cost the current cart consumes.

**The key thing to try (proves the whole system):** put one Iced Latte in the
cart, then click through the channel tabs and watch the deduction list:

- **Dine-in** → ingredients only (reusable glass, no disposables).
- **Takeaway** → adds **cup, lid, straw**.
- **Talabat** → adds **delivery bag, napkins, sticker, tamper seal, carrier**,
  and the **price rises to the Talabat price** — so margin % drops. That gap is
  real business insight.

**Features present here:** product favourites/tiles, channel selection, live
COGS & margin, cash/card tenders, a receipt, and the movement preview. ✅

**🔜 After DB wiring:** search, sizes/modifiers/add-ons pickers, discounts/comps
with reason + manager approval, suspended orders, refunds/voids, printed/shared
receipts, cash-drawer open/close and shift reconciliation, and true **offline
selling** (queue + exactly-once sync).

---

## 5. Orders

**Location:** Sidebar → **Orders** · `/orders` · ✅ Live now

The record of the day's sales.

- **Three stat cards:** Orders today, Net sales, Gross profit.
- **Orders table:** each row shows **Order #, Time, Channel, Product, Net, COGS,
  Margin (%)**.
- **"Drill into an order"** — under the table each order is an expandable panel.
  Click one to reveal the exact **inventory movements** it posted (item + base
  quantity + cost). This demonstrates the append-only trail: every sale is a set
  of permanent movements.

**Try it:** expand `S-1045` (the Talabat order) and compare its deductions to
`S-1044` (takeaway) — the Talabat one has the extra delivery packaging.

**🔜 After DB wiring:** filters (by channel/time/cashier), search, and **void /
refund with a reason + approval** (financial rows are never edited — a void or
refund posts a reversal).

---

## 6. Products & Recipes

**Location:** Sidebar → **Products & Recipes** · `/products` · ✅ Live now

How each product is built and priced. One card per product (demo: _Iced Latte_,
_Gelato Cup — Pistachio_), each with two tables:

- **Recipe** — every component line: **Component, Qty, Applies to**. The "Applies
  to" column is the important one — it says whether a line deducts on **all
  channels** or only on specific ones (e.g. _Delivery bag → Direct delivery,
  Talabat_). This is exactly how packaging differs by channel.
- **Price & margin by channel** — a row per channel showing **Price, Cost,
  Margin (%)**. You can see at a glance where a product makes the most/least.

**Categories of items you'll see in recipes:** ingredients (coffee, milk, syrup,
ice, pistachio), finished goods (pistachio gelato), packaging (cup, lid, gelato
cup, delivery bag, carrier), and consumables (straw, spoon, napkin, sticker,
tamper seal).

**🔜 After DB wiring:** a recipe **editor** (add/remove lines, quantities),
**recipe versioning** with effective dates, different recipes per size, images,
allergens, prep instructions, and activate/deactivate without losing history.

---

## 7. Production

**Location:** Sidebar → **Production** · `/production` · ✅ Live now (interactive)

Make a batch of a prepared item (demo: **pistachio gelato**) and see the real
costing.

**Step-by-step:**

1. **Batches** — how many batches you're making (default 1).
2. **Actual yield (g)** — how much you _actually_ got. The planned yield is shown
   next to the field (5,000 g/batch).
3. Watch the four cards update:
   - **Total consumed cost** — value of the raw materials used.
   - **Finished-goods value** — what the output is worth (= consumed cost; no
     value invented).
   - **Output unit cost** — consumed cost ÷ actual yield (so short yields cost
     more per gram).
   - **Yield variance** — planned − actual (short or over).
4. **Raw materials consumed** table — each ingredient, base-unit quantity, and
   cost, plus the **finished output** row.

**Try it:** change _Actual yield_ from 4,800 to 4,000 and watch the **output unit
cost rise** — that's the cost of waste made visible.

**🔜 After DB wiring:** saving a batch (which atomically consumes ingredients and
creates a traceable finished-goods lot with production/expiry dates), rejected
quantities & quality notes, and a **production-planning** screen that recommends
quantities from forecast demand, stock, expiry, and expected waste.

---

## 8. Inventory

**Location:** Sidebar → **Inventory** · `/inventory` · ✅ Live now

Everything you hold, valued — computed from the ledger, never typed.

- **Four stat cards:** Items tracked, Inventory value, Low stock (count),
  Expiring ≤ 3 days (count).
- **Stock table** — per item: **Item, Category, On hand, Unit, Reorder, Unit
  cost, Value, Status**. The **Status** column badges each item: `low` (below
  reorder), `expiring <date>`, or `ok`.

**Categories (the "Category" column):** Ingredient, Packaging, Consumable,
Finished good, Resale — every consumable is tracked down to a single straw.

**Reads to notice:** _Delivery bag_ and _Drink carrier_ show **low**; _Pistachio
gelato_ shows **expiring**. These match the Dashboard alerts.

**🔜 After DB wiring:** a **movement-ledger browser** (every receipt/sale/waste/
transfer for an item), stock by location, transfers between branches/kitchen,
lot & expiry drill-down, and live low-stock/expiry alerts.

---

## 9. Stock Count

**Location:** Sidebar → **Stock Count** · `/count` · ✅ Live now (interactive)

Count stock the honest way — **blind**, then post a correction.

**Step-by-step:**

1. **Item** — pick the item to count.
2. **Counted quantity** — type what you physically counted. Note you do **not**
   see the expected number yet (that's what "blind" means — it stops "just tick
   the box" counting).
3. **Submit & reveal variance (manager)** — reveals the result:
   - **Expected (system)** vs **Counted**.
   - **Quantity variance** = counted − expected (red if short).
   - **Value variance** = variance × unit cost.
   - A note showing the **`count_adjustment` movement** that would post on
     approval — bringing the ledger to the counted figure _without_ erasing
     history.
4. **Re-count (hide expected)** — go again.

**Try it:** pick **Straw** (expected 9,979) and enter **9,959** → you'll see a
**−20** quantity variance and a **−400 IQD** value variance, and the exact
adjustment it would post. (This is acceptance scenario #8.)

**🔜 After DB wiring:** full/cycle/category/location counts, save & resume,
multiple counters, recount requests, variance-threshold approvals, barcode
scanning, and counting in packages (converted to base units).

---

## 10. Purchasing

**Location:** Sidebar → **Purchasing** · `/purchasing` · ✅ Live now (interactive)

Receive goods and watch cost accounting happen.

**Step-by-step (fields, left to right):**

1. **Item** — what you're receiving (demo: Straw, Milk, Coffee beans).
2. **Purchase unit** — the unit you buy in (**Carton (1,000)**, **Case (12 × 1
   L)**, **Kilogram**, …). This is the star of the screen — you buy big, stock
   small.
3. **Quantity** — how many of that purchase unit.
4. **Goods value (IQD)** — what the goods cost.
5. **Freight (IQD)** and **Rebate (IQD)** — landed-cost adjustments.
6. Read the **Goods receipt result** card:
   - **Received in base units** — the conversion (e.g. 5 cartons → **5,000 each**).
   - **Landed value** — goods + freight − rebate.
   - **Landed unit cost** — landed value ÷ base quantity.
   - **Avg cost before** vs **Avg cost after (WAC)** — how this receipt shifts the
     moving weighted-average.
   - **New on-hand** — the resulting quantity.

**Try it:** with **Straw / Carton (1,000) / 5 / goods 90,000 / freight 2,000**,
you'll see **+5,000 each**, landed value **92,000**, landed unit cost **18.4
IQD**, and the average cost tick down accordingly. (Acceptance scenario #1 is the
conversion; landed WAC is the costing engine.)

**🔜 After DB wiring:** supplier management, purchase orders, goods receipts that
post real movements, partial deliveries, purchase invoices, supplier balances,
and price-change history.

---

## 11. Delivery Platforms

**Location:** Sidebar → **Delivery Platforms** · `/platforms` · ✅ Live now

The truth about delivery economics — the customer's payment is **not** your
revenue or your payout.

- **"Talabat order … — economics"** table walks the full chain:
  Merchant list value → − merchant-funded discount → (+ platform-funded discount
  is reimbursed, so it doesn't reduce you) → **Net merchant sales** → − commission
  → − payment processing → − advertising → − refunds → **Expected merchant
  payout** → − product cost (COGS) → **Channel contribution profit**.
  (Demo: 6,000 → 5,500 → **payout 3,650** → **contribution 1,740**.)
- **"Settlement reconciliation"** — summary chips (Matched, Expected total,
  Reported total, Issues) and a table of every discrepancy the engine found, with
  the money impact:
  - **Payout difference** (reported vs expected),
  - **Incorrect commission**,
  - **Unexplained adjustment**,
  - **Missing payout** (a completed order absent from the statement).

**Try it:** read the issues table — the demo statement underpays order 1 by 200,
overcharges commission by 200, and **omits order 2 entirely (−4,200)**. That's
money you'd otherwise never notice.

**🔜 After DB wiring:** CSV import of orders/settlements, a **mock Talabat
adapter** (until Partner API credentials are granted), internal↔external product
mappings, per-platform pricing & promotions, and a reconciliation workbench to
resolve each issue.

---

## 12. Accounting

**Location:** Sidebar → **Accounting** · `/accounting` · ✅ Live now

Management accounting, shown honestly.

- **"Today — profit shown honestly"** — the layered P&L: **Gross sales → − COGS →
  Gross profit → − platform commissions & fees → Contribution profit**. A note
  explains that fixed overhead (rent, salaries) is deliberately _not_ subtracted
  here — that's a separate, labelled estimate.
- **"Sample journal entry"** — a real **double-entry** example (Cash sale:
  Dr Cash / Cr Sales; Dr COGS / Cr Inventory) with a **Totals** row and a
  **✓ Balanced** badge. A note explains the database rejects any unbalanced entry
  and blocks posting into a locked period; corrections are reversing entries.
- **"Chart of accounts"** — the configurable account list (Cash, Platform
  receivable, Inventory, Payables, Sales, COGS, Commission, Waste, Rent…).

**🔜 After DB wiring:** automatic posting from sales/COGS/purchases/settlements, a
journal browser, accounting periods with locking, supplier & platform balances,
and CSV/Excel/PDF export for your accountant.

---

## 13. Reports

**Location:** Sidebar → **Reports** · `/reports` · ✅ Live now

Analysis computed live by the costing engine.

- **"Product margin by channel"** — every product × channel with **Price, Cost,
  Margin, Margin %**. This is menu-engineering data — notice margin dropping on
  Talabat.
- **"Today's channel mix"** — orders, net sales, and gross profit grouped by
  channel.
- **"Available report set (scheduled)"** — lists the full report catalogue whose
  data is already captured (menu engineering, discount/promotion profitability,
  actual-vs-theoretical usage & food cost, waste, variance, stock ageing,
  supplier performance, production yield, platform reconciliation, cashier/shift
  reconciliation).

**🔜 After DB wiring:** those additional reports as views, date-range filters,
drill-through to transactions, and CSV/Excel/PDF export.

---

## 14. AI Insights

**Location:** Sidebar → **AI Insights** · `/ai` · ✅ Live now (example cards)

How AI assistance will look — **without needing any API key**. The banner makes
clear these are format examples until a provider is configured.

- A note states the guardrails up front: **AI only explains, forecasts, and
  recommends — it never changes money or stock.** Human approval is required
  before creating a PO, changing a price/recipe, adjusting inventory, posting a
  journal, publishing a promotion, or contacting a supplier; every AI call is
  audited.
- **Insight cards** — each shows the full anatomy of a recommendation:
  **kind, title, recommendation, explanation, confidence %, forecast horizon,
  data used, impact,** and an **approve** button (disabled here — needs a key +
  human approval). Examples: a production plan, a reorder suggestion, a
  money-losing promotion, and an unusual-void fraud watch.

**🔜 After DB wiring + an AI key:** live forecasts and suggestions computed from
your real data, natural-language questions ("How much pistachio gelato should we
make tomorrow?"), and one-click approvals that turn into (human-approved)
actions. The core app keeps working fully with **no** AI key.

---

## 15. Settings

**Location:** Sidebar → **Settings** · `/settings` · ✅ Live now

Configuration and the security model.

- **Business configuration** — name, **currency (IQD, 0 decimals — configurable)**,
  **timezone (Asia/Baghdad, stored UTC)**, **languages (EN/AR/CKB, RTL)**, units
  (metric), costing method (moving weighted-average; FIFO optional), and the
  **negative-stock policy**.
- **Locations** — Main Branch and Central Kitchen (the model is multi-branch /
  warehouse ready from day one).
- **Roles & permissions** — a card per role (Owner, General manager, Branch
  manager, Cashier, Barista, Inventory counter, Purchasing, Accountant, Auditor)
  listing exactly which permissions it holds. This is the **tested** policy that
  drives the UI and is re-checked on the server.

**🔜 After DB wiring:** a first-time **setup wizard** (business + branch details,
users, MFA, opening balances) and user/role administration.

---

## 16. Feature index

Every headline feature → where to find it. (✅ clickable now · 🔜 after DB wiring.)

| Feature                                                   | Location                | Status         |
| --------------------------------------------------------- | ----------------------- | -------------- |
| Switch language (EN / AR / CKB, RTL)                      | Top bar → Language      | ✅             |
| Light/dark theme                                          | Top bar → ☀️/🌙         | ✅             |
| Online/offline indicator                                  | Top bar                 | ✅             |
| Owner KPIs, low-stock, expiry, recon                      | `/dashboard`            | ✅             |
| Channel-aware selling (Dine-in/Takeaway/Delivery/Talabat) | `/pos` → channel tabs   | ✅             |
| Cart, quantities, live COGS & margin                      | `/pos`                  | ✅             |
| Cash / card checkout + receipt + movement preview         | `/pos`                  | ✅             |
| Discounts/comps, refunds/voids, offline queue             | `/pos`                  | 🔜             |
| Order list + per-order deduction drill-in                 | `/orders`               | ✅             |
| Recipe breakdown + channel packaging rules                | `/products`             | ✅             |
| Price & margin by channel                                 | `/products`, `/reports` | ✅             |
| Recipe editor / versioning                                | `/products`             | 🔜             |
| Production batch cost & yield variance                    | `/production`           | ✅             |
| Production planning suggestions                           | `/production`           | 🔜             |
| Stock-on-hand (derived), value, low/expiry                | `/inventory`            | ✅             |
| Movement-ledger browser, transfers, lots                  | `/inventory`            | 🔜             |
| Blind count → variance → adjustment                       | `/count`                | ✅             |
| Purchase-unit → base-unit conversion                      | `/purchasing`           | ✅             |
| Landed cost → moving weighted-average                     | `/purchasing`           | ✅             |
| Suppliers, POs, receiving, invoices                       | `/purchasing`           | 🔜             |
| Delivery-platform payout & contribution                   | `/platforms`            | ✅             |
| Settlement reconciliation (issue flags)                   | `/platforms`            | ✅             |
| CSV import / mock Talabat adapter                         | `/platforms`            | 🔜             |
| Layered P&L (several profit numbers)                      | `/accounting`           | ✅             |
| Double-entry journal + balance check                      | `/accounting`           | ✅             |
| Chart of accounts                                         | `/accounting`           | ✅             |
| Auto-posting, periods, exports                            | `/accounting`           | 🔜             |
| Product/channel margin, channel mix                       | `/reports`              | ✅             |
| Full report catalogue + exports                           | `/reports`              | 🔜             |
| AI insight format + guardrails                            | `/ai`                   | ✅             |
| Live AI forecasts / NL questions                          | `/ai`                   | 🔜 (needs key) |
| Business config, currency, timezone, locales              | `/settings`             | ✅             |
| Roles & permissions matrix                                | `/settings`             | ✅             |
| Login, MFA, PIN, setup wizard                             | `/settings`             | 🔜             |

---

### Where the numbers come from

Every figure on the ✅ screens is computed by the same tested calculation engine
(`src/domain/*`) documented in [`CALCULATIONS.md`](CALCULATIONS.md). The 12
required business scenarios that back these features are listed and automated in
[`TEST_PLAN.md`](TEST_PLAN.md). Current build status per module is in
[`PROGRESS.md`](PROGRESS.md).

### What "after DB wiring" unlocks

Connecting login + the database turns every 🔜 into a real, saved action: real
users with roles, sales that persist and post to the ledger, receiving that moves
stock, counts that adjust it, journals that auto-post, and reports over your true
history. See [`ROADMAP.md`](ROADMAP.md) for the sequence.
