# Explicit Assumptions

These are the defaults the system was built on. Every one is either configurable
in-app or easily changed. If any is wrong, tell us and we adjust.

## Business

1. **Location:** Sulaymaniyah, Iraq. Single branch at launch; data model already
   supports multiple branches, warehouses, and a central production kitchen.
2. **Currency:** IQD by default, displayed with **0 decimal places** (integer
   dinar). Currency code, symbol, and decimal precision are stored on the
   `business` row and configurable. Money math is exact regardless.
3. **Quantities:** metric; stored to sufficient precision (e.g. grams, millilitres,
   each). Display rounding is applied only at boundaries.
4. **Timezone:** Asia/Baghdad. All timestamps are stored in **UTC** and displayed
   in the business timezone.
5. **Languages:** English (LTR), Arabic (RTL), Kurdish **Sorani `ckb`** (RTL).
6. **Channels:** dine-in, takeaway, direct delivery, Talabat; extensible to
   Careem, Toters, and others.
7. **Tax:** out of scope for now (no tax fields calculated).

## Costing & accounting

8. **Costing method:** moving weighted-average by default; FIFO lot costing is
   supported where appropriate. Method is a business setting.
9. **Contribution profit** = expected net platform payout − variable product
   cost (COGS). Fixed overhead is **not** subtracted here; allocated profit is a
   separate, clearly-labelled estimate requiring an allocation method.
10. **Platform-funded discounts** are reimbursed and do not reduce merchant
    revenue; **merchant-funded** discounts do.
11. **Refunds** are financial reversals and do **not** auto-return physical goods
    to stock; only items flagged `returnable_to_stock` re-enter inventory.

## Technical

12. **Database:** Supabase (PostgreSQL + Auth + Storage + RLS). The cloud DB is
    authoritative. You provide/connect the project; nothing is auto-provisioned.
13. **Auth:** email + password (Supabase Auth); optional MFA for owner/manager;
    optional numeric PIN for fast cashier switching on a shared POS device.
14. **Offline:** IndexedDB queue with UUID idempotency keys + device id +
    timestamps; exactly-once sync enforced by a DB UNIQUE constraint.
15. **AI:** optional. With no provider key, all core features work. Anthropic is
    the reference adapter; OpenAI or another approved provider can be selected.
16. **Deployment:** app on Vercel (or any Node host); DB on Supabase. Nothing is
    deployed automatically.

## Demo data

17. All seed prices and costs are **illustrative examples**, explicitly labelled,
    and must be replaced with real figures before production use.
