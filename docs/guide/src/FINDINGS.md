# What writing the guide found

Things noticed in the code while each screen was described. None is changed
yet: they wait for the owner's word.

- Reports: a From date after the To date shows the general "This screen could
  not be loaded" page instead of a plain message (Sales analysis says it plainly).
- Reports: "Stock value on a day" and "Balance sheet and cash flow" never count
  as opened, so they never move up in the most-opened order.
- Dashboard: "runs out … using about 88.07 a day" shows a daily use with two
  decimals and no unit (each, g, ml).
- Dashboard: the low-stock line says "at or below their reorder level"; it
  counts items strictly below.
- docs/CALCULATIONS.md: the waste alert reads 5300 and 5310 since 0048, not 5300 alone.
- Purchase order page: the Unit column shows raw codes (e.g. case_24).
- Vendors: "Edit vendor" saves without a retry key (a lost answer is not retried).
- Meal deals and prices by the hour: a price that is not a number may show
  "Expected number, received nan"; each press makes a new retry key, so a
  dropped answer pressed again could add a second price by the hour.
- Stock counts: the status words (counting, submitted, approved…) have no
  translation and show in lower case.
- Rules: three rules may be set per branch in the database (daily sales
  target, labour target, transfer charge), but the screen offers no branch row.
- Two-step sign-in: if the owner loses the phone with the authenticator app,
  no screen offers a way back in (it is removed in Supabase Auth).
- Till: collecting a pre-order (or making a customer invoice) can be refused
  when the books hold less stock than needed and the rule asks for a manager,
  but neither window offers a manager's approval: staff are stuck.
- Till: "Discard" tells a cashier a manager will check Orders, a screen the
  cashier cannot open (fine as information, but worth wording).
- Till: the main screen has no heading ("Point of Sale" shows only when empty).

Missing features the task guides ran into (described as they are):

- No screen changes the café's details (name, currency, time zone, default
  language, bill numbers); Settings only shows them.
- Places (branches, the kitchen, the warehouse) cannot be added or renamed on
  a screen.
- An earlier sale's receipt cannot be printed again (Orders prints refund slips only).
