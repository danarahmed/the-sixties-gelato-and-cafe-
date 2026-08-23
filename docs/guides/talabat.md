# Configuring Talabat (and other delivery platforms)

The system is **platform-agnostic**: Talabat, Careem, Toters, direct web, or
manual/CSV all use the same generic model. Nothing about the schema is
Talabat-only.

> **Important, honest note:** Talabat's official Partner API requires an approved
> partner account and credentials, typically arranged through a Talabat account
> manager. We do **not** invent endpoints or credentials. Until real access is
> granted, use the **CSV import + mock adapter** below — it is fully functional
> for reconciliation and profit analysis.

## Option A — CSV / manual import (available now)

1. Export your orders/settlement from the Talabat partner portal as CSV.
2. In **Delivery Platforms → Import**, upload the file.
3. Map columns once (order id, list price, discounts, commission, fees,
   refunds, payout). The mapping is saved.
4. Each order is stored with **every economic component separately**. Re-importing
   the same file never duplicates orders (natural-key idempotency).

## Option B — Live API (when you have Partner credentials)

1. Obtain from Talabat: API base URL, API key, and your store id.
2. Set in the server environment (never in client code):
   ```
   TALABAT_API_BASE_URL=...
   TALABAT_API_KEY=...
   TALABAT_STORE_ID=...
   ```
3. Enable the Talabat adapter in **Settings → Delivery Platforms**. Until then a
   clearly-labelled **mock adapter** simulates order/settlement flows for testing.

## Mappings you set once

- Internal branch ↔ external store id.
- Internal product/variant ↔ external product/variant id.
- Internal order ↔ external order id (used for idempotency).

## Settlement reconciliation

After each settlement statement (CSV or API), open **Reconciliation**. The system
matches expected vs reported and flags: missing payouts, duplicates, incorrect
commission, unexplained adjustments, cancelled-but-charged orders, payout
differences, and unmatched lines — with the money impact of each.

## Pricing

Set different prices per platform, branch, time period, and promotion, subject to
your contract rules. The customer's payment is never assumed to equal your
revenue or payout.
