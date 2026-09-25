# Cashier Quick-Start

## Signing in

- Open the app and sign in with **your own email and password**. Never share a
  login: every sale and every bill records who rang it up.
- **First time?** Your manager adds your email first. Then choose **First time
  here? Create your login**, set a password, confirm the email you receive, and
  sign in.
- **Forgot your password?** Choose **Forgot password?**; the email you receive
  takes you to **My account**, where you set a new one.
- As a cashier you see the **POS** and **My account**. That is by design.

## The till

The till fills the screen. **☰** (top corner) opens the menu; **⛶** makes the
browser full screen. Along the top:

- **🪑 Tables | ☕ Menu** switches between the floor (every table, free or
  taken) and the products.
- **⚡ Quick sale** and one chip for every **open bill**: tap a chip to open
  that bill. A **🧾** on a chip means its bill has been printed and handed to
  the customer, and the money is still to come.

The panel on the right is the order you are working on.

### Finding a product

- **Tap a category** (Coffee, Gelato…) or **★ Favourites** at the top, or
- **type in the search box**: English, Arabic or Kurdish, any spelling of
  alef or yeh. **/** jumps to the search from anywhere; **Enter** adds the first
  match.
- A number on a tile is how many are already in the order. A product sold in
  several sizes asks which one.

## A sale paid now (counter, takeaway)

1. **⚡ Quick sale**, then pick the channel: **Dine-in**, **Takeaway**,
   **Direct delivery** or **Talabat**. The channel sets the price and the
   packaging taken from stock, so always pick the right one.
2. **Tap the products.** **−** and **+** change a quantity; **✎** adds a note
   (“no sugar”); **Clear** starts again.
3. **💵 Cash** or **💳 Card** opens the payment:
   - for cash, type what the customer handed over, or tap **Exact** or a note
     (5,000, 10,000…). The **change** is worked out for you;
   - **Confirm payment**. Pressing it twice never charges twice.
4. **✅ Sale recorded** appears with the sale number. **🖨 Print receipt**
   prints it.

A **Talabat** order has one button, **🧾 Complete (paid through the
platform)**: Talabat collects the money. Type the **Talabat order number**
from the tablet (the `#` before it can be left out), then **Confirm
payment**. The sale is not recorded without it, and the receipt prints it. If
the till says the number is already recorded, the order was rung before:
check the tablet, and do not ring it again.

## A table, paid later

1. **🪑 Tables**, tap the table. A free table starts a new bill.
2. Tap the products, then **💾 Save**. The table now shows what it owes and how
   long it has been open. Tap it again to add more.
3. When they ask for the bill: **🖨 Print bill**. The table turns amber:
   **waiting for payment**.
4. When they pay: open the table, **💵 Cash** or **💳 Card**, **Confirm
   payment**. The bill closes and the sale is recorded.

Nothing reaches the books until the bill is paid.

**Once a bill has been printed, you can add to it but not take anything off.**
A manager can, and it is recorded. Ask a manager if a customer returns
something from a printed bill.

**The customer pays the prices on the printed bill**, even if a price goes up
after it was printed. One more of something already on it is at the printed
price too.

### Paying separately

- **✂ Split bill:** choose what one person is paying for (use **+**, or
  **All** for a whole line). It moves to a new bill, **Table 5 · 2**, shown at
  once so you can take their money. The rest stays on the table's bill.
- **⇄ Move:** the party changed tables, or the bill was opened on the wrong one.

### A customer who will pay in a moment

In a quick sale, **🕒 Keep open, pay later** keeps the order as a bill under
the customer's name (or at a table). It waits as a chip at the top until they
pay. On the floor, **＋ Bill for a customer** starts one directly.

### Cancelling a bill

**✕ Cancel bill**: an empty bill can be closed by anyone. **A bill with
anything on it needs a manager**, who chooses the reason from a list ("Customer
left without ordering", "Opened by mistake", "Moved to another bill", or
"Other" with a few words); it is kept on the audit trail. Taking an item off a
bill is on the audit trail too, printed or not.

### Two tills, one bill

Every till shows the same bills and refreshes every few seconds. If two people
change one bill at the same moment, the second is told **“This bill was changed
on another till. Open it again to see the latest”**. Nothing is overwritten.

### When a price has just changed

The till checks the total with the database before it records a payment. If a
price changed after the till loaded the menu, the payment is **not** taken, and
the till says **“The total is 3000 now, not the 2500 shown: a price has
changed…”**. The till fetches the new prices by itself and shows the order at
them: tell the customer the new total, then take the payment again. (Tills pick
up new prices every ten minutes, and whenever the till screen comes back to the
front.)

## Printing

Bills and receipts are laid out for an **80 mm receipt printer** and print on
any printer. Set the receipt printer as the computer's **default printer**. In
the print window, choose that printer, **Margins: None**, and untick
**Headers and footers**. The browser remembers these settings.

- **Print the receipt after every payment** (under the order) prints each
  receipt without the extra tap.
- To print with no print window at all, start Chrome or Edge on the till with
  `--kiosk-printing` added to its shortcut. It then prints straight to the
  default printer. Use this only on the till computer.

## If the connection drops

- A red **Offline** banner appears and taking payment is blocked. **Nothing is
  sold or saved while offline.** Take payment only once the banner is gone.
- If the connection dropped **during** a payment, the till says it did not hear
  back and freezes that order. Press **Retry** when you are back online. If the
  payment went through, it is not recorded twice. **Never ring it up again.**
- **Discard — a manager will check Orders** clears a frozen order from your
  till. Use it only if the customer left without paying, and tell a manager.

## Giving a discount

Under the order, **＋ Discount** opens two boxes:

- type a **percentage** (10) and the amount (500) is filled in for you,
  **rounded to the nearest 250 IQD** so the change is always in notes: 47% of
  8,500 is 3,995, so 4,000 comes off and the customer pays 4,500;
- or type an **amount** (750) and the percentage (15) is filled in. An amount
  is taken exactly as you type it.

A small percentage can round to nothing (2% of 2,500 is 50): type the amount
you want to give instead.

**Why?** Choose the reason from the list under the boxes: staff meal, on the
house, regular customer, to make up for a complaint, a promotion, or "Other"
with a few words of your own. The customer cannot pay until a reason is chosen.

**Over 10%** of the bill, a manager approves it: the till says **"Over 10%: a
manager approves it."** Tap **🔑 Ask a manager**; the manager chooses their
name and types their PIN on your till, and the discount shows **✓ Approved by**
their name. A wrong PIN is refused (and counted: five wrong in fifteen minutes
stop that manager's approvals for a while). The approval is for that discount,
once: change it and ask again. Owners and managers giving a discount
themselves are not asked.

The **Total** is what the customer pays. The bill and the receipt show the
full price, the discount and the total. A percentage on a table's bill follows
the bill as more is added. **✕** takes the discount off.

Only people allowed to give discounts see the box, and a delivery-platform
order takes no discount at the till. **Once a table's bill has been printed,
only a manager can change its discount**, just as only a manager can take
items off it.

## Mistakes

A finished sale cannot be edited. Tell a manager:

- **until the drawer is counted**, they can **void** it: everything comes back
  exactly, and its cash leaves what the drawer should hold;
- **after the count**, they **refund** it.

Both are done on **Orders**, with a reason from the list. Another manager (or
the owner) may approve it there with their name and PIN; without a second
person it goes on the owner's review.

## Making a batch (baristas)

When you make gelato, a base, syrup or dough, record it on **Production →
Record a batch**, right after:

1. **What did you make?** Choose it. The form shows what it uses.
2. **Batches:** how many (1, 2, or 0.5 for half).
3. **What came out** (optional): if you weighed or counted it, enter it, in kg,
   pans, pieces, whatever the list offers. Leave it empty if it came out as the
   recipe says.
4. **Record batch.** The ingredients leave stock and what you made goes in.

Recorded the wrong thing? Tell a manager: they cancel the batch, with the reason.

## End of the day

A manager counts the drawer and closes the day on **Sales**. **The day cannot
close while any bill is still open**: every table must pay, or have its bill
cancelled by a manager, first.

## Settings in the top bar

- **Language:** English, العربية or کوردی (Arabic and Kurdish switch the whole
  screen right-to-left, product names included).
- **☀️ / 🌙** switches light and dark.
- **My account** has your name, your role and a password change.
