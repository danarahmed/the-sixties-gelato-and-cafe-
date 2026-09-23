# Known Limitations

What is **not** built, what is deliberately left out, and what depends on
something outside this repository. Nothing here is claimed to work. The status
of every audit finding is in [`PROGRESS.md`](PROGRESS.md).

## Until this version is deployed

- **The live site is publicly writable.** It still runs the previous app, which
  anyone holding its public key can read and write. The fix is this version;
  until it is deployed, turn on Vercel deployment protection. See
  [`guides/deployment.md`](guides/deployment.md).
- **The existing history is unverified.** It must be reviewed and corrected, or
  replaced by a clean start, before the books are relied on. See
  [`REMEDIATION.md`](REMEDIATION.md).

## Not built

- **Delivery-platform settlements (audit M-10).** Platform orders are sold as
  platform-paid and post to 1100 Platform receivable. Settlement import, fee
  matching and the reconciliation workbench are not built. A payout is recorded
  with a manual journal ([`guides/talabat.md`](guides/talabat.md)).
- **Production batches (M-11).** Batch history is shown, but a batch cannot be
  recorded, so finished-goods stock and yield variance are not tracked. Until it
  is built, give a product a recipe of its ingredients (as the live menu does):
  each sale then takes its ingredients out of stock directly.
- **Offline selling (H-04).** The till needs a connection. Offline, it says so
  and refuses the sale. A sale whose confirmation was lost is retried with the
  same key and recorded once. An offline queue would need its own design for
  stock and prices that change while the till is offline.
- **Partial refunds.** A refund returns the whole sale. A partial refund is a
  refund of the sale followed by a new sale for what was kept.
- **Discounts and comps at the till.** The till sells at the channel price.
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
- **Monitoring.** No error monitoring or uptime checks are configured.

## Deliberate constraints (not bugs)

- Stock is never typed in: it is the sum of the movement ledger. It is corrected
  with a count or a manager's correction.
- A published journal, a finished sale and a bill are never edited. They are
  corrected by a reversal, a void or refund, or a cancellation, and both the
  original and the correction stay on record.
- A locked month refuses every posting. Reopening it is the owner's decision,
  with a reason on the audit trail.
- Full payment-card details are never stored.
