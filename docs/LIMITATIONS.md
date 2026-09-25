# Known Limitations

What is **not** built, what is deliberately left out, and what depends on
something outside this repository. Nothing here is claimed to work. The status
of every audit finding is in [`PROGRESS.md`](PROGRESS.md).

## Before the books are relied on

- **The records so far are tests.** The live site has run this version, closed
  to the public, since 23 September 2026, when the trial history was cleared.
  Everything recorded since is a test too (the owner, 25 September), and is
  cleared when the owner says so, keeping the set-up
  ([`guides/deployment.md`](guides/deployment.md), "Clearing the test
  records"). Then each item needs its opening stock before its first sale, or
  that sale is costed at nothing.

## Not built

- **Delivery-platform settlements (audit M-10).** Platform orders are sold as
  platform-paid and post to 1100 Platform receivable. Settlement import, fee
  matching and the reconciliation workbench are not built. A payout is recorded
  with a manual journal ([`guides/talabat.md`](guides/talabat.md)).
- **Production (M-11), what it does not do.** Batches are recorded, costed and
  cancelled, and made items are kept and sold (see the walkthrough). It does not
  plan batches ahead, track lots or expiry dates, or move stock between the
  branch and the central kitchen; a batch is recorded at the branch, when it is
  made (not backdated).
- **Offline selling (H-04).** The till needs a connection. Offline, it says so
  and refuses the sale. A sale whose confirmation was lost is retried with the
  same key and recorded once. An offline queue would need its own design for
  stock and prices that change while the till is offline.
- **Partial refunds.** A refund returns the whole sale. A partial refund is a
  refund of the sale followed by a new sale for what was kept.
- **One cap for everyone.** Since `0028` every discount has a reason, and one
  over the business's cap (10%) needs a manager's approval; the cap is the
  same for every role that may give discounts, and it is changed in the
  database, not on Settings. A journal's narration is still free text.
- **Alerts, what they do not do (`0029`).** The rules are checked when the
  dashboard opens, not in the background, and nothing is sent: there is no
  email, WhatsApp or phone notification, and the daily brief waits on the
  dashboard rather than arriving at 07:00. The alert texts and the brief are
  in English only. Running out knows a delivery time per supplier, taken from
  the item's last delivery; an item with no delivery yet uses the café's. Card
  and platform money not in is judged from the clearing accounts' balances
  until P1-9 matches settlements to sales. Use-by dates (P2-7) and a late sale
  (impossible since `0024`) raise nothing.
- **Balance sheet and cash-flow statements.** The trial balance carries every
  balance, and the P&L is built; the formatted balance sheet and cash-flow
  statements are not.
- **Chart of accounts maintenance (M-06).** The accounts a café needs are all
  there. Adding or deactivating one needs a migration: there is no screen for it.
- **Attachments and PDF (L-05).** There is no scan of an invoice on a bill or an
  expense, and no PDF export. CSV export exists for the trial balance, P&L and
  reconciliation.
- **Translations (L-06).** Navigation, sign-in, the till and the offline
  messages are in English, Arabic and Kurdish. Most screen bodies are English
  only.
- **Transfers between locations.** The Central Kitchen exists as a location, but
  stock cannot yet move between locations.
- **Tax.** Out of scope by request. If the business is VAT-registered, that is a
  structural addition, not a setting.

## Needs something outside the repository

- **Talabat Partner API.** A live connection needs an approved partner account and
  credentials from Talabat.
- **Backups and restore drills.** Backups are configured in the Supabase project,
  not here. A restore has not been drilled against this schema (see
  [`guides/backup-restore.md`](guides/backup-restore.md)).
- **MFA and sign-up policy.** Both are Supabase settings. The runbook recommends
  MFA for the owner, and turning off open sign-up once everyone has a login.
- **Monitoring.** No error monitoring or uptime checks are configured, and
  there is no channel (email, WhatsApp) to send alerts or the daily brief.

## Deliberate constraints (not bugs)

- Stock is never typed in: it is the sum of the movement ledger. It is corrected
  with a count or a manager's correction.
- A published journal, a finished sale and a bill are never edited. They are
  corrected by a reversal, a void or refund, or a cancellation, and both the
  original and the correction stay on record.
- A locked month refuses every posting. Reopening it is the owner's decision,
  with a reason on the audit trail.
- Full payment-card details are never stored.
