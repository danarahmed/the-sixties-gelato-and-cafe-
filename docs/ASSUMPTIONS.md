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

12. **Database:** Supabase (PostgreSQL + Auth + RLS). The database is
    authoritative and does the posting: every write is one checked function in
    one transaction (ADR 0002). You provide/connect the project; nothing is
    auto-provisioned, and the app has no built-in address or key.
13. **Auth:** each person signs in with their own email and password (Supabase
    Auth). A login is linked to a member of the business only once its email is
    confirmed; the owner adds people and their roles under Settings → People.
    MFA is recommended for the owner. There is no shared PIN.
14. **Offline:** selling needs a connection. Offline, the till says so and
    refuses the sale; a sale whose confirmation was lost is retried with the
    same idempotency key and recorded exactly once.
15. **AI:** none. Expense classification is local, deterministic rules that
    propose an account for a person to confirm.
16. **Deployment:** app on Vercel (or any Node host); DB on Supabase. Nothing is
    deployed automatically. See `docs/guides/deployment.md`.

## Data

17. All seed prices and costs are **illustrative examples**, explicitly labelled,
    and must be replaced with real figures before production use.
18. Everything recorded before the controls (migration 0014) is unverified until
    reviewed. It is kept unchanged, marked "before controls", and corrected only
    by new, dated entries (`docs/REMEDIATION.md`).
