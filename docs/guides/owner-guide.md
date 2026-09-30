# Owner's Guide

The system is your set of books. Every sale, delivery, bill, payment and count
writes its own entry, and the books check themselves. Your job is to keep people
and records honest, and to close each month.

## The ideas behind it

- **Stock counts itself.** Nobody types a stock level. Stock is the sum of
  everything received, sold, wasted and counted, down to a single lid.
- **Nothing is quietly changed.** A finished sale, a published journal and a bill
  are never edited. A mistake is corrected by a new entry, and both stay on the
  record.
- **The books prove themselves.** **Reports → Do the books tie?** compares stock,
  unpaid bills, goods awaiting their bill, and sales with their accounts. A month
  can be locked only when every check shows ✅.

## Before you rely on the books

Your books start empty: the trial records were cleared on 23 September 2026,
before the upgrade. Everything recorded since is a test too, and is cleared
once more when you say so, keeping the menu, the stock items, suppliers,
tables and people ([deployment runbook](deployment.md), "Clearing the test
records"). Then enter your opening balances before the first sale:

- **Inventory → Opening stock:** each item — what is on the shelf, what one
  unit cost, and where it came from (the opening count, say). It is capital you
  put into the business, so only you can record it, and it is on the audit
  trail. Until an item has it, its sales are costed at nothing.
- Stock not yet paid for: as a delivery and its bill (**Purchasing**,
  **Vendors**).
- **The drawer:** open it on the till, counting what is in it (nothing, the
  first time). Then **Sales → Move Cash:** the float you put in the till, and
  any cash in the safe, from the owner. Money already in the bank: a journal,
  Dr 1020 Bank, Cr 3000 Owner equity.

Then **Reports → Do the books tie?** shows ✅ on every line.

A database that keeps history from before this version must treat it as
unverified until it is corrected ([`../REMEDIATION.md`](../REMEDIATION.md)).

## People

**Settings → People**:

- **Add a person** by name and email and tick their roles. They create their own
  login with that email, and see only what their roles allow.
- **Change roles** or **Deactivate** someone the day they leave. A deactivated
  person keeps their login but can no longer see or do anything in the books.
- Only you can make someone an owner or general manager, or take their access
  away, and the business always keeps at least one active owner.
- **Works at** (once the café has a second place): everywhere, or one of the
  café's places. Someone who works at the second branch records nothing
  anywhere else: not a sale, a void, a drawer's count or a delivery. Their
  devices work there, and offer no other place. You and the general manager
  work everywhere.

| Role              | Typically does                                                                                                                                                                                                               |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Owner             | Everything, including reopening a locked month and control corrections                                                                                                                                                       |
| General manager   | Everything except reopening a locked month                                                                                                                                                                                   |
| Branch manager    | Sells, voids and refunds, opens and closes the drawer, receives stock, approves purchase orders up to their limit, reviews counts, records expenses; keeps the staff, their PINs, the schedule and the hours (not their pay) |
| Cashier           | Sells; opens and closes the drawer                                                                                                                                                                                           |
| Barista           | Sells, gives away, opens and closes the drawer, records losses                                                                                                                                                               |
| Inventory counter | Counts stock, blind                                                                                                                                                                                                          |
| Purchasing        | Adds suppliers, drafts purchase orders, receives goods and returns them, records bills and credit notes                                                                                                                      |
| Accountant        | Expenses, journals, locking months, the reports; pay, advances and payroll                                                                                                                                                   |
| Auditor           | Reads everything with a cost on it, payroll included; changes nothing                                                                                                                                                        |

The exact matrix is under **Settings → Roles & what they may do**.

## Staff, their hours and their pay

**Staff** (the owner and the managers) lists **who works here**: everyone
paid, whether or not they have a login. **+ Add someone who works here** with
their name, what they do, where they work and the day they started; link their
login if they have one. Then:

- **Set a PIN** with them: they type 4 to 8 digits twice, and clock in and out
  at the till with their name and that PIN. A PIN like 1111 or 1234 is refused.
- **Set the pay** (you, the general manager or the accountant): by the month,
  the day or the hour, a day's standard hours, and, if theirs differs from the
  café's rule, the overtime percentage. Only those who see payroll (you, the
  general manager, the accountant and the auditor) see anyone's pay.
- **Last day…** when someone leaves: from the day after, they no longer clock
  in and their shifts are taken off. Their records and pay stay.

**The schedule** is a week at a time, Saturday to Friday: type each person's
hours as `08:00-16:00` (a shift ending at or before it starts ends the next
day), or copy **the same hours as the week before**, and **Save the week**.

**The hours** show, day by day, who was on the schedule, when they clocked in
and out, and who was late, left early, was absent or worked overtime (beyond
their standard hours). A manager **corrects** a record (a forgotten clock-out),
**adds** hours nobody clocked (the till was down), or **cancels** a mistake,
each with the reason, all on the audit trail. Nothing here changes pay by
itself.

**Payroll** (you, the general manager, the accountant; the auditor reads it):

1. After the month ends, **Draft the payroll** for it. Each person's pay comes
   from their pay and their hours: a month's pay for the days employed, a day's
   pay for each day worked, or an hour's for each hour, plus overtime; and any
   advance they owe is taken back.
2. **Adjust…** a line to add (a bonus) or deduct (an absence), always with why,
   or to take back less of an advance. If hours or pay change afterwards, the
   draft says so: **Draft it again** (what you added and deducted stays).
3. **Approve the payroll.** It posts Dr 6100 Salaries, Cr 2100 Salaries
   payable, Cr 1300 the advances taken back, dated on the month's last day.
4. **Pay…** each person, or **Pay everyone**, from the bank, the safe, the
   till's open drawer or your own pocket. A payroll with a mistake is
   **reopened** (with why) while nothing is paid from it; a payment made by
   mistake is cancelled first.

**Advances on pay** are given on Payroll (from the bank, the safe, the till or
the owner) and taken back by the next payroll. An advance given by mistake is
cancelled while none of it has been taken back.

## Customers and their points

**Customers** (you, the managers; the accountant and the auditor read it)
lists **who buys from the café**, found by name or part of their number, with
their points, how many times they bought and what they spent. Customers are
added at the till by their phone number, or here with **+ Add a customer**; a
number typed any way (0770 123 4567, +964 770 123 4567, Arabic digits) is one
number, and one customer.

A customer's page gives their details and **notes about them** (what they like,
what to leave out), their **addresses** for the café's own deliveries, **what
they bought** (a delivery with the address it went to), and **how their points
moved**. **Change their details** or **Put them away** (someone added twice, or
who asked to be): a customer put away keeps what they bought, and is no longer
put on a sale until brought back. An address put away stays on the orders
delivered to it.

**Points** (the rules are under **Settings → Open Rules →**): a point for every 1,000 IQD a
sale comes to, after its discount, once paid; 100 points are a reward of
5,000 IQD off, taken at the till as the bill's discount (posted to 4100, like
any discount, with the reason "Loyalty reward"). A void takes back what the
sale earned and gives back what it spent; a refund does so for what it gives
back. Points owed or given by mistake are put right with **Give or take
points** (you and the managers): a minus takes them, always with why, on the
audit trail.

**Reports → Customers** gives the points earned, spent, taken back and given
by hand in the dates, the rewards taken and what they took off, the points
customers hold now and what they would take off, and who bought the most.
Points are not a debt in the books: their worth reaches them only as rewards
are taken.

## What sells, and when

**Reports → Sales analysis** answers the questions a till's totals do not:

- **Which hours are busy?** See the sales by **Hour**, for a month: plan the
  staff and the batches for them. **By Day of the week** does the same for
  the week, Saturday first.
- **What earns the most?** By **Product** (or **Category**, or **Size**), the
  margin beside what each sold for; **then by Channel** shows where it sells.
  **By Add-on** says which extras are taken, and what they bring in.
- **Who sold what?** By **Who took the money**, then by **Payment**: each
  person's sales and how they were paid.
- **What stuck?** Every row shows what refunds gave back of it since, and
  what was **kept**: a product often given back shows it here.

Every way adds up to the same sales, and voided sales are left out (their
count is below the table). **CSV** takes it to a spreadsheet.

**Reports → Stock value on a day** gives what the stock was worth at the end
of any day, item by item, beside what the books held: for the month's end, or
an insurer. **Purchasing**, on Reports, says what came in from each supplier
and of each item in the dates.

## What the café owns and owes, and where the cash went

**Reports → Balance sheet and cash flow** (for you, the managers, the
accountant and the auditor) puts the two statements an accountant or a bank
asks for on one page:

- **The balance sheet**, at the end of the day before the dates and at their
  end, side by side: the cash in the till, the safe and the bank; card takings
  not yet in the bank, the stock, advances; the equipment; what the café owes;
  and what is yours, with the profit not yet closed into Retained earnings. It
  says **It balances** when what the café owns is what it owes plus what is
  yours.
- **The cash flow** of the dates: the cash at the start, where it came from
  and went (sales; stock and suppliers; staff; running costs; the drawer's
  counts; equipment; your money in and out; dollars changed), and the cash at
  the end. A bill counts as what it was for, so a machine paid through a bill
  shows under equipment. Money moved between the till, the safe and the bank
  is not a flow.

Each account opens its journals, and **CSV** takes either statement to a
spreadsheet. Pick **This year** for the year so far.

## An account of your own

To see a cost or an income apart (repairs, the internet, catering), add its
account on **Chart of Accounts → Add an account** (you, a general manager or
the accountant): **A cost** or **An income**, its code (the next free one is
proposed), its name in English and, if you like, in Arabic and Kurdish, so
every screen shows it in the reader's language. A cost's code starts with 5
(the cost of what was sold) or 6 (the running costs); an income's with 4. A
cost is offered at once on **Expenses** and on a bill for an account, and
its lines are on the profit and loss.

- **Rename…** changes its name; its Arabic and Kurdish stay unless you give
  new ones.
- **Take out of use…**, with why, when you no longer want it offered:
  nothing new goes to it, and what went to it stays in every report. Publish
  or discard any draft journal that uses it first. **Bring back…** undoes it.
- The accounts the books post to themselves (the till, the bank, sales, the
  stock and the like) stay as they are. An asset, a debt or money of yours is
  added by whoever looks after the system, so that the balance sheet and the
  cash flow know where it goes.

## Keeping the paper with the record

A delivery note, a supplier's bill or credit note, a return slip and the
receipt for an expense can be kept with their record, as a photo or a PDF.
**📎** by the record's number opens them: on Purchasing (deliveries and
returns), Vendors (bills, credit notes, and each supplier's statement) and
Expenses. The number beside it says how many are kept.

- On a phone, **📷 Take a photo** opens the camera. On a computer, **📄
  Choose a picture or a PDF** takes the scan or the supplier's email
  attachment.
- A large photo is made smaller before it is sent, and stays readable.
- A wrong one is **taken off**, saying why. It is never deleted: the page
  lists it apart, and the audit trail says who took it off and why.

Whoever records that kind of record attaches its papers. Whoever sees costs,
you and the accountant among them, sees them.

**Print or save as PDF**, at the top of this page and of every other report,
prints it headed with the café, the report and its dates, without the menu.
In the print window, choose **Save as PDF** to keep it as a file or send it
to the accountant.

## Languages

Every screen is in **English, Arabic and Kurdish (Sorani)**: its headings,
buttons, forms, tables, messages, the alerts on the dashboard, the daily brief,
the words the books write themselves (the chart of accounts, a journal's
narration) and what the database says when it refuses something. Each person
chooses their language in the menu at the top of the page; Arabic and Kurdish
read right to left.

**Settings → Languages** (the owner and the general manager):

- **Add a language**: its short international code (tr for Turkish, fa for
  Persian, kmr for Kurmanji Kurdish), its name as its speakers write it
  (Türkçe, فارسی), and whether it is written left to right or right to left.
  It is in everyone's language menu at once. A phrase with no words in it yet
  shows in English, so the screens work while it is being translated.
- **Give its words**: under **Words in …**, find a phrase (search, or show only
  the phrases with no words yet), type its words, and **Save**. Words keep the
  `{name}` marks of the English: they are where a number or a name goes.
- **Hand it to a translator**: **Download CSV** gives every phrase, its
  English and its words so far; the translator fills in the `words` column,
  and **Upload CSV** reads it back for you to check and save.
- **A better Arabic or Kurdish word**: choose العربية or کوردی under **Words
  in …** and type the café's own word over the built-in one; clear it to have
  the built-in word back.
- **Take a language out of use**: it leaves the menu, and its words are kept
  for when you bring it back.

Every language added or changed, and every change of words, is on the audit
trail. The names of products, items and categories are typed by the café in
English, Arabic and Kurdish; in a language you add they show their English
name.

## The café's rules

**Settings → Open Rules →** (the owner and the general manager, `0040`). Each
rule shows what it does, who set it, when and why, and every change is kept:

- **Discounts a manager approves**: over 10% of the bill by default. Set it for
  a role to let that role give more, or less, without a manager.
- **Refunds a second person approves**: over 25,000 IQD by default; a manager's
  refund over it needs your PIN, or another manager's.
- **Losses a manager approves**: over 50,000 IQD by default, on their own or
  added up — one person's over their cash session (or their day), and an
  item's over the day by anyone, so small losses cannot slip through one at a
  time. Over it, a manager types their PIN, or the loss waits for one under
  **Needs you**. The same limit holds for what is given away at the till,
  where a manager's PIN is asked there and then.
- **Using more stock than the books hold**: what is made here is refused by
  default, and everything else is sold with a red alert on the dashboard. Set
  an item, or a kind of item, to **Refused** once it is counted reliably, or
  to **A manager approves it** to have a manager decide each time.
- **Overtime is paid at**: 150% of an hour's pay by default (100% to 300%); a
  person's own percentage, set with their pay, comes first.
- **Late, or leaving early, by more than**: 5 minutes by default.
- **Someone still clocked in after**: 16 hours by default, an alert (red
  after a day): they may have forgotten to clock out.
- **Salaries are paid on the day of the month**: the 1st by default. From
  then, last month's payroll not approved or not paid is an alert, red a week
  later.
- **Customers earn points, and take rewards**: on by default. Off, nothing is
  earned or taken, and the points customers hold are kept for when it is on
  again.
- **A customer earns a point for every**: 1,000 IQD by default, of what a sale
  comes to after its discount.
- **A reward takes**: 100 points by default; **A reward is worth**: 5,000 IQD
  off by default, taken whole: a bill smaller than a reward cannot take it.

A change takes a reason; set a rule back to its default the same way. Nothing
else changes them: the business row's old settings are the defaults until they
are retired.

## Setting up the till

A café with a hundred products and twenty tables needs a till that finds things
fast. Set it up once, on **Products** and on the till itself:

- **Categories** (Products, at the top): name each one in English, Arabic and
  Kurdish, and number them in the order the till should show them. Untick **On
  the till** to hide a whole category, a seasonal menu say, without touching its
  products.
- **Each product** (Products): **Add photo** takes a picture from the phone or
  the computer. The browser shrinks it to a small file first, and only PNG, JPEG
  and WebP pictures are accepted, judged by their contents. Choose its
  **category**, tick **★ Favourite** for the ten or so things sold all day
  (they get a chip of their own), and untick **On the till** for anything not
  sold now. A hidden product keeps its recipe, prices and history, and comes
  back by ticking the box again.
- **A new product** (Products, **➕ Add menu product**): build its recipe
  first. The form costs it as you type, at today's stock costs and exactly as a
  sale will post it: each ingredient, then **Cost of one serving** (more for
  takeaway and delivery, where the cup and lid are used). Then choose the
  prices: each channel shows its cost and, as you type, the margin, in amber
  when under your target and red for a loss. **Use 4,000 IQD** takes the
  suggested price, the lowest in 250 IQD steps that leaves your target margin
  (70% unless you change it; as a rule of thumb, coffee drinks leave 75–80%
  and food 65–70%). Delivery
  platforms take their commission from the price, so price them higher. An
  ingredient never bought counts as 0: receive it first, or give it its
  opening stock on Inventory, for a true cost. A product with no ingredients
  (a service charge, say) needs a reason for using no stock; without a recipe
  or a reason it is not created, since every sale of it would show full
  profit.
- **Changing a price or a recipe** (Products, open **Recipe, prices, sizes and
  add-ons**): **Change a price…** starts today or on a later date, never an
  earlier one, so every sale keeps the price it was made at; each change is on
  the audit trail (**price.set**). A change for a later date is listed under
  **Scheduled** on the product, and can be withdrawn with a reason until it
  starts. A recipe changed today does not cancel one scheduled for later: each
  takes over on its own date. A new price reaches every till within ten
  minutes, or at once when its screen comes back to the front; a till that has
  not caught up yet is stopped at payment and fetches it then. A bill already
  printed is paid at the prices printed on it.
- **Sizes and add-ons** (Products, `0041`): open **Recipe, prices, sizes and
  add-ons** on a product's card. **+ Add a size** adds a Large beside the
  Regular, at its own prices, copying the Regular's recipe to change
  afterwards, or with its own.
  Under **Add-ons** (a section of its own) make the groups the till asks for:
  **Milk**, the fewest 1 and the most 1, so no latte is rung up without its
  milk; **Extras**, the fewest 0 and the most 3. Give each add-on its price
  per channel and what one uses. Then tick, on each product, the groups it
  offers, with every size or some. Take the milk out of a latte's recipe and
  give each milk its own: every cup then counts the milk it was made with,
  and **Reports → Sizes and add-ons** shows which sizes and add-ons sell and
  what each leaves.
- **Split payments** (the till, `0042`): **➗ Split** in the payment window
  takes part in cash and part by card, or two cards. Each goes to its own
  account; only the cash part goes into the drawer, and the change is worked
  out from what was handed over. A refund of such a sale gives back each way
  its share, or as the customer wants, never more than a way paid. **Reports
  → Sales by payment method** shows what cash, card and the platforms took.
- **US dollars** (`0043`): each morning a manager sets the day's rate on
  **Sales → Dollars**, saying where it comes from (an exchange office, the
  market). The till takes dollars at it for 36 hours, valued to the nearest
  250 and with the change in dinars (both rules on **Settings → Rules**).
  At each close the dollars are counted with the dinars and all go to the
  safe; a dollar missing or found is posted to 6300 at what the dollars were
  taken at. When you change them, record it on **Sales → Dollars → Exchange
  dollars for dinars**: what you received against what they were taken at
  goes to 6950 Exchange differences. **Reports → Dollars** shows it all, and
  the books check the dollars held against 1001 and 1006.
- **Costed at nothing:** a product flagged this way on Products has no recipe,
  or uses an ingredient with no cost yet, so its sales show full profit. Give
  it its recipe (or say why it uses no stock), or give the ingredient its cost.
  **Reports → Uncosted Sales** lists the sales it has affected; they keep the
  cost they were recorded with.
- **What you make** (Production): set up each thing made in batches once, with
  what one batch makes (roughly; weighing is optional) and what goes in. Make a
  base first and flavour it, or make each flavour from scratch: both work, since
  a batch may use anything in stock, bought or made. Then have whoever makes it
  record each batch on Production (baristas can; they see no costs). Switch the
  product to the made item with **Change the recipe…** on Products (a cup of
  pistachio gelato: 120 g of pistachio gelato, a cup, a spoon), so each sale
  takes the gelato out at what it cost to make.
- **Tables** (on the till: **🪑 Tables → Edit tables**, for owners, general
  managers and branch managers): add them one by one, or twenty at once
  ("Add 20 tables named Table starting at 1"). Give them an **area** (Inside,
  Garden) to group them, and a number to order them. A table with an open bill
  cannot be taken out of use.
- **Printers and the barista's ticket:** every order prints on two slips, cut
  apart: the customer's receipt, with every detail, and the barista's ticket,
  with the order's number in large figures and what to make, without prices.
  The number starts again at 1 every day (at midnight, the café's day), comes
  from the database so two tills never give out the same one, and stays with
  the order: a table's bill takes it when it is opened, and its sale keeps it
  (since `0034`). Each till chooses on **🖨** (at the top of the till) whether
  it prints by itself and whether the barista's ticket comes out; **Test
  print** prints a sample of both. Setting the printer up: the [cashier
  quick-start](cashier-quickstart.md#printing). Slips are laid out for an
  80 mm receipt printer.

**How bills are controlled.** A table's bill is not a sale until it is paid,
and then it is recorded exactly like a sale at the counter. So a served drink
cannot quietly disappear from a bill:

- once the bill has been printed for the customer, **only a manager can take
  anything off it**, and each reduction is on the audit trail (**bill.reduce**);
  and it is paid at the prices printed on it, whatever the menu says by then;
- **cancelling a bill with anything on it needs a manager and a reason**
  (**bill.cancel**);
- splitting a bill needs no manager, because nothing leaves the table's bills;
  it is logged too (**bill.split**);
- **the day cannot be closed while a bill is still open.**

**Discounts.** A cashier can give a discount as a percentage or an amount.
The permission is "discount.apply": owners, managers and cashiers have it, and
a barista does not. If only managers should give discounts, the cashier role
can lose it; that is a change to the role matrix, not a setting on a screen. Every discount is on the audit trail (**sale.discount**), and once a
bill is printed only a manager can change its discount (**bill.discount**).
A percentage comes to the nearest **250 IQD** (shown on **Settings**), so the
till never asks a customer for a few odd dinars; an amount is taken as typed.
The step is a business setting: changing it (to 500 or 1,000, say) needs no
new version of the app, and each till follows it once it is refreshed.
In the books, revenue is recorded at the full price and the discounts in
**4100**, so the P&L shows how much was given away, and **Do the books tie?**
counts them.

**Reasons and approvals** (since `0028`). Every discount, void, refund and
cancelled bill takes a reason from a list; "Other" needs a few real words. A
discount over **10%** of the bill needs a manager's approval on the till: the
manager chooses their name and types their **PIN**, which each owner and
manager sets on **My account** (four to eight digits, not a run like 1234; the
database keeps only a hash). Owners and managers give larger discounts
themselves. A void or refund may be approved on **Orders** by a second person
the same way; one without goes on your review. Each sale keeps who gave its
discount, why and who approved it. The 10% is a business setting (shown on
**Settings**): to change it, ask for it to be changed in the database.

## Every day

- **Dashboard:** it opens on **what needs you** — 🔴 now, 🟠 soon. Each says
  what happened, why it matters, what to do (follow it to the screen where it
  is done) and how sure the rule is. When you have dealt with one, **Answer**
  it in a line (what was done, or why it is fine); if it can wait, **Snooze**
  it until a day, with a reason. Either way it stays, marked 🔵, until its
  condition clears, and then leaves by itself; one that turns from orange to
  red asks again. Many of one kind (say, twenty ingredients with no cost yet)
  fold into one row to open. 🟢 means nothing needs you. Below it,
  **yesterday's brief** — what happened, what follows from it, and what to do,
  kept apart — then today's revenue, gross profit, orders, stock value, low
  and negative stock, and whether the books reconcile.
- **The drawer, in sessions.** Whoever works the drawer opens it on the till
  by counting what is in it, and closes it at the end of their shift by
  counting again ([cashier's guide](cashier-quickstart.md#the-drawer)); the
  till takes cash only while it is open. The count is blind: the cashier, the
  barista and the branch manager are shown what the drawer should hold only
  once their count is in, so they count what is there. You, the general
  manager, the accountant and the auditor see it at any time on **Sales → The
  Drawer**. A session covers everything from its opening count to its closing
  count, past midnight too. Each difference posts to 6300 Cash over / short
  for its session: at the close against what it should have held, and at the
  opening against what the last session left (cash that went missing between
  shifts shows there). What stays in the drawer is chosen at the close; the
  rest goes to the safe or the bank. A bill still open is paid in the next
  session. When the drawer changes hands, **Hand over** closes one session and
  opens the next on what was left, in one step. A session left open is closed
  on **Sales → The Drawer → Close it for them** by you or a manager, with the
  reason, counted or not. Opening the drawer, a manager can put a float in from
  the safe. **Sales → Cash Sessions** lists every session with what it opened
  with, what it should have held, what was counted and the difference; each
  opens its statement, every movement of its cash. Sales also shows every day
  whose cash no closed session has covered; a month cannot lock until each is.
  The dashboard warns of a session open too long, one short by the limit or
  more (at its opening or its close), and one a manager closed.
- **Paying for something:** always say where the money came from — the till,
  the safe, the bank, a card (which the bank pays), or you personally. From
  the till it comes out of
  what the drawer should hold, and neither the till nor the safe can pay out
  more than the books say it holds. Put money into the till (a float), take
  takings to the safe, or bank them with **Sales → Move Cash**; only you can
  take money out for yourself.
- **Orders:** a sale rung in error is **voided** until the session holding
  its cash is closed; after that, it is **refunded**, whole or only some of
  its items: a customer who brings back one bottle of three gets one bottle's
  share back, and the rest of the sale stands. Each refund has its own
  number, goes back the way the sale was paid (cash from the open drawer, a
  card to the card, a platform's order off what it owes) and prints its own
  slip.
- **Reports → Exceptions:** every void, refund, discount, cancelled bill, item
  taken off a bill and wrong PIN, by person, with the reason and who approved
  it. Those marked **review** are yours to look at: a void or refund nobody
  else approved, or a wrong PIN. It downloads as CSV.
- **The alerts' thresholds** are yours (and the general manager's): on
  **Settings → Alerts**, the margin you aim for (70%), how long a count may
  stay open (8 hours), how long a drawer's session may stay open (14 hours)
  and how short a session must be to warn (5,000 IQD), how many days
  card and platform money take to arrive (3 and 7), and the rest; an empty box follows its default, and every change
  is on the audit trail. On **Vendors → Edit vendor**, say how many days each
  supplier takes to deliver: running out warns that much sooner for what they
  supply.

## Every day, in the kitchen

- **What to make** (**Production**): the day's plan says, for each thing you
  make, what it sold and was used on this weekday over the last four to eight
  weeks, what is on hand and still good at the end of the day, and so how
  many batches to make, with the ingredients that will be short. **Tomorrow**
  shows the next day. Until four weeks of history, it says there is not
  enough to judge by.
- **Use-by dates:** give each recipe how long it keeps (**Change…**, _What it
  makes keeps for_), and every batch is used by then from when it was made,
  unless a date is given when it is recorded. **In stock by batch** lists
  every batch with something left, the one to use first first: sales take
  it in that order, and one past its use-by last. A batch due within a day is
  an orange alert; one past it, red: record what is left as expired on
  **Inventory**, or, if the date was wrong, a manager changes it
  (**Change the use-by…**, with why).
- **A batch forgotten:** a manager records a batch made earlier today or
  yesterday (**Made earlier**), with why; not before the last approved count
  of its items.
- **Each batch's page** (its number on Production, or Reports → Production)
  says what came out and what became of it — sold, used in other batches,
  lost, found or missing on a count, still in stock — every bit accounted for.
- **The central kitchen:** set the kitchen's tablet once to **Stock at:
  Central Kitchen** (beside the title of Inventory, Production and the other
  stock screens). What it records — batches, losses, counts, deliveries — is
  then the kitchen's, and its screens show the kitchen's stock. Its day's plan
  is what it sends the branch on that weekday. The kitchen sells nothing: its
  till asks which branch it sells at, when there is more than one.
- **A second branch:** each till sells at its branch (**Till at**, above the
  till, once there are two): that branch's drawer, tables, open bills and
  turn numbers from 1, at its prices. A price of a branch's own is set on the
  product (**Change a price… → At**); the product card lists it.
- **Sending stock between them** (**Inventory → Transfers**): the branch sends
  the kitchen its milk and sugar, the kitchen sends the branch its gelato. It
  is on its way until the other place receives it: **Received: all of it**, or
  **Not all of it arrived…** with what did, the rest written off as lost. A
  batch keeps its number and use-by at the branch. One sent by mistake is
  cancelled while on its way, and goes back.

## Every week

- **What to buy** (**Purchasing → Open What to buy**, or the dashboard's alert
  that something bought is running out): the list says, for each
  item bought, what is on hand and coming, what it uses a day, and so whether
  to order and how much, in whole packs, from its usual supplier, with why.
  Give each item a reorder level and a par level on its page for the list to
  follow your numbers rather than its own; an item with under a week of
  history says so. Tick what to order, change what needs changing, and
  **Create the orders**: a draft for each supplier, to approve as any order.
  On an item's page, **Bought from** keeps who sells it, in what pack, at what
  price, and the usual one.
- **Purchase orders** (**Purchasing**): whoever buys drafts an order — the
  supplier, each item at the unit and price agreed, the day it is expected.
  A branch manager approves orders up to 250,000 IQD; above that, you or the
  general manager do (change the limit on **Settings → Rules → Purchase orders
  a manager approves, up to**, for a role). Mark it sent and print it from its
  page for the supplier. When the delivery comes, choose the order on the
  receiving form: what is still to come is filled in, at the order's prices,
  and anything different — less, more, another price, an item not ordered —
  is shown before it is received; more than ordered is confirmed on the audit
  trail. Close an order when all has come, or say why the rest is not coming.
- **Goods going back** (**Purchasing → Return goods to a supplier**): name the
  delivery they came in and why. Before its bill, the bill is then for what
  was kept; after it, the supplier owes the goods back as a credit, set
  against the bill. When the supplier's credit note comes, record its number
  on **Vendors → Credit notes**, where you also record their credit notes for
  a lower price or an overcharge, and set what is left of a credit against
  their next bill. Each supplier's statement between two dates is printed from
  their **Statement** tab, to agree the account with them.
- **Purchasing:** receive deliveries as they arrive, each line at its price
  per unit as the invoice gives it. A price more than 25% above or below what
  the item costs now is asked about before anything is received ("2.5 or
  50?"): correct it, or confirm it, and the confirmation is on the audit trail.
  Stock goes up, and the goods wait in 2050 Goods received not invoiced for
  their bill. Each item's card on Inventory shows what every delivery cost.
- **Something delivered that is not in Inventory yet:** add it from the
  receipt itself. On the line, choose **+ New item (not in Inventory yet)…** at
  the top of the item list, give its name (in Arabic and Kurdish too, if you
  like), its type, how it is measured, and the pack it is bought in with what
  the pack holds (a carton of 24, a sack of 25,000 g). **Add the item**: it goes
  into Inventory, the line takes it by its pack, and its stock comes in with
  the delivery. While a name is typed, the items already there whose names look
  like it are shown — "Botled water" beside **Bottled water**, the same words in
  another order, the same word in Arabic or Kurdish letters. Choose **Use it**
  if it is one of them; if it is truly a different item, **It is a different
  item: add it**. The same name, whatever its capitals or spaces, cannot be
  added twice. Inventory's **Add stock item** warns the same way.
- **Vendors:** record each supplier's bill against its delivery, typing the
  amount from the invoice (the screen shows what the delivery recorded; a
  difference posts to 5050), and pay bills from the till, the safe, the bank, a
  card or your own pocket. Watch **Payable ageing** on Reports. A bill without
  the supplier's own number takes the café's (SGC-2026-0001, -0002 …): each is
  given once, is never reused (not even after a cancellation), and cannot be
  typed in by hand, so it can never be mistaken for a supplier's invoice.
- **Card takings, when the bank pays them** (**Sales → Card Takings**): choose
  the last day the bank's payment covers — a day that is over; today's card
  takings wait for tomorrow — then type the terminal's total for those days,
  from its report, and what reached the bank. The difference between the two
  is the card company's fee (6500 Card and bank fees). When the till and the
  terminal differ — a sale rung as card and paid in cash, or the other way —
  say why in the note; it posts to 6300 Cash over / short. Days are settled in
  order; the latest settlement can be cancelled, with the reason, and settled
  again.
- **Delivery platforms, when a statement comes:** on **Delivery Platforms →
  Match a Statement**, choose its file (**Read it from its file…**, Excel or
  CSV) or paste it, check what matched, what did not and which orders it left
  out, and post the payout (see the [Talabat guide](talabat.md)).
  The dashboard names the orders a platform has not paid after 7 days.
- **A new delivery platform:** add it on **Delivery Platforms → Your Delivery
  Platforms**, with its name in Arabic and Kurdish, and copy the packaging and
  prices of the channel it works like (usually Talabat). It is then a button on
  the till, with its own prices, order numbers and statements. Rename one, or
  take one out of use, on the same list (see
  [Adding a platform](talabat.md#adding-a-platform)).
- **Stock Count:** have a counter count, then review and approve it yourself (see
  the [counting guide](counting-guide.md)).
- **Losses waiting for approval:** a loss over the limit that a barista saved
  to wait is on the dashboard and on **Inventory**. Approve it, or reverse one
  that did not happen, with a reason; a product lost is approved or reversed
  whole.
- **What is lost, by kind (`0048`):** each loss is recorded as what it is, and
  charged to its own account: waste, spoilage, expired, damaged and melt to
  5300 Waste & spoilage; what is lost making a batch or preparing to sell to
  5310 Production and preparation loss (both are cost of sales); a staff meal
  to 6110 Staff meals, on the house to 6610 Complimentary items and a sample
  to 6620 Marketing samples (expenses, below the gross profit). Staff meals,
  drinks on the house and samples are given away at the till (**🎁 Give
  away…**), with why; ingredients are recorded on **Inventory → Record a
  loss**. **Reports → Losses** shows what was lost in any dates, by kind and
  account, by item and by person, and every giveaway.
- **Usage:** after the count, open **Usage** for what each item used since the
  last count against what its recipes say. Red is stock gone that nothing
  explains; look at what may explain it beside each item, and at the item's
  stock card.
- **Audit trail:** read who changed what — prices, products, items, suppliers,
  settings — with each value before and after. Anything marked **No one signed
  in** was changed in the database itself: ask who did it, and why.
- **Reports → Product margin by channel:** what each product earns on each
  channel.

## Every month

1. Close the drawer's session after the month's last sale, approve or reject
   any pending count, and publish or discard any draft journal. Draft, check
   and approve the month's payroll on **Payroll** before you lock the month:
   once it is locked, the payroll cannot be posted into it (the checklist
   warns you).
2. **Reports → Do the books tie?**, as at the last day of the month: every line
   should show ✅ — the stock, payables, deliveries not billed, sales, card
   takings, what the platforms owe, the drawers, the safe, salaries owed,
   advances not yet taken back, and every record with its journal. A ⛔ says which account and by how much, and opens both
   sides; a record without its journal is listed under the table.
3. **Chart of Accounts:** choose the month and read its checklist. When every
   check passes, **Lock** it. The last month of the year also closes the year
   into 3100 Retained earnings. A ⚠️ line (sales costed at nothing) is a
   warning, not a lock: those sales' profit is overstated, and **Reports →
   Uncosted Sales** lists them and what to fix.
4. A locked month refuses every posting. Only you can reopen it, with a reason
   on the audit trail. Reopen the most recent locked month first.
5. With more than one place, read **Reports → Profit & Loss by place**: each
   branch's and the kitchen's column beside the café's. A sale is the branch's
   that sold it, a loss the place's where the stock was, an expense the place's
   where it was recorded; Talabat's payout is shared out by each order's branch
   and the payroll by where each person works. **Shared** is what belongs to no
   one place: the bank's card fees and journals by hand. The columns add up to
   the café's total.
6. **The bank against its statement** (Chart of Accounts, `0059`): when the
   bank's statement for the month comes, choose its file (**Read it from its
   file…**, the Excel or CSV the bank's website gives): the lines the books
   have are found and ticked, and its last day and closing balance filled
   in. Or type them, and tick the lines it shows, by eye. Keep it when it
   ties. What it shows that the books do not (a charge, interest) is listed:
   **Record it** opens Expenses with a charge filled in, or a journal with
   interest filled in; choose its account, post it, and come back. What the books have and it does not (a payment
   not yet cleared) waits for the next one.
7. **Prepaid expenses** (Expenses, `0060`): before the month is locked, if
   the Dashboard says prepaid expenses are due, press **Release what is due**
   on Expenses: each month's share of the rent or insurance paid ahead is
   then that month's expense. The month is not locked until it is. Record a
   cost paid for months to come with **Paid ahead for months to come**, not as
   an expense of the month it was paid in.
8. **Place** on Reports (`0057`) reads every report for one place: its sales
   and payments, its losses, what came in and went back, its orders and
   batches, its dollars, its staff and its customers' sales. Someone who works
   at one place, a branch manager say, reads only theirs, and their
   Dashboard is their place's day. The books' checks, the statements, the
   journals, the payables and the customers themselves stay the café's.

## Why is a number what it is?

Open it. Every figure on the Dashboard, every line of the P&L and of the trial
balance, and each side of **Do the books tie?** opens the records or the
journal lines behind it; an item on Inventory opens its **stock card** (what it
opened with, what came in and went out, and what is left); a day on Sales opens
its orders. Two profits are shown, each named for what it is: **gross profit
after waste & fees** (Dashboard, P&L) and the **sales margin** (price less the
recipe cost, on Sales by Channel, Sales and Orders). A refund counts on the day
it is made, so net sales are the same on every report. **Reports → every journal
line (CSV)** gives your accountant the whole ledger.

## Correcting a mistake

| The mistake                                                              | Correct it with                                                                                                                  |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| A sale rung wrongly, or some of it brought back                          | **Orders → Void** (until its session closes) or **Refund**, all of it or the items brought back                                  |
| A bill entered twice or wrongly                                          | **Vendors → Cancel** (only if nothing was paid on it), then enter it correctly                                                   |
| A delivery entered wrongly (not yet billed)                              | **Purchasing → Correct** (quantity, price, item, supplier, day) or **Reverse** (never came), with the reason                     |
| Stock that is wrong                                                      | a **count**, or **Inventory → Correct stock** (manager), with the reason                                                         |
| An item or a vendor named, typed or levelled wrongly                     | its card on **Inventory → Correct this item**, or **Vendors → Edit vendor**, with the reason; take one no longer used out of use |
| A manual journal or an expense                                           | **Journals → Reverse**, dated in the month it corrects                                                                           |
| A control account (the till's cash, Inventory, payables, goods received) | your **Correction to a control account** on Journals — owner only, with a reason. Meant for history from before these controls   |

## Golden rules

- Record a loss when it happens, as the kind it is, and give away at the till
  rather than discount to nothing: it keeps stock, cost and each account right.
- Ring each order on the right channel: the packaging depends on it.
- Replace the example prices and costs with your own before relying on margins.
- Give everyone their own login, and deactivate leavers the same day.
