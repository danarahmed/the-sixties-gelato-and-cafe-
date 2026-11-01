# What writing the guide found

Things noticed in the code while each screen was described, and what the
owner decided on 1 November 2026. Put right in migration `0095` and the
screens with it, unless said otherwise.

## Things that stopped work

- **Fixed (A1).** Till: collecting a pre-order or making a customer invoice
  could be refused when the books held less stock than needed and the rule
  asked for a manager, with no way to get one. Now such a sale, already
  agreed with the customer, goes ahead without a manager and is noted on the
  audit trail with why. A rule that refuses still refuses.
- **Fixed (A2).** Clock: linking a phone to a second person left the first
  person's phone counted as linked. Now one phone is one person: the old link
  ends, and the phone says whose it was.
- **Fixed (A3).** Purchasing: a delivery priced entirely at 0 could not be
  received. Now it is received at no cost and moves nothing in the books;
  freight on it is refused, as there is nothing to share it by.

## Features that were missing

- **Fixed (B1).** Settings → The café's details: the owner changes the name
  and default language; the currency, the time zone and the bill numbers
  until anything is sold or posted.
- **Fixed (B2).** Settings → Places: add, rename (three languages), close
  (with a reason, once nothing is open or left there) and open again. A new
  place has its till drawer at once and every screen and report counts it.
- **Fixed (B3).** Orders: **Print receipt again**, marked COPY.
- **Fixed (B4).** Settings → Rules: the daily sales target, the labour target
  and the transfer charge take a row per branch.
- **Fixed (B5).** Two-step sign-in: eight backup codes, shown once; one of
  them at sign-in takes the second step off when the phone is lost.

## Protection against duplicates and confusing errors

- **Fixed (C1).** Meal deals and prices by the hour keep one retry key per
  press, so an unanswered press sent again is never recorded twice.
- **Fixed (C2).** Vendors → Edit vendor is sent again by itself when no
  answer comes (an edit sets the same values twice, so no key is needed).
- **Fixed (C3).** A price that is not a number says "Type the price as a
  number, e.g. 3500".

## Wording and display

- **Fixed (D1).** "Runs out … using about 88 each a day": with its unit, and
  rounded as people round.
- **Fixed (D2).** The purchase order page names a pack ("Case of 24"), not
  its code.
- **Fixed (D3).** Reports: a From date after the To date says so plainly,
  with the two dates offered the right way round.
- **Fixed (D4).** Dashboard and Stock: "below their reorder level", as they
  count; "No item is below its reorder level" when none is.
- **Fixed (D5).** Stock counts: the status in words (Counting, Waiting for
  review, Approved, Rejected), in the three languages.
- **Left as it is (D6).** The till's main screen has no heading.
- **Fixed (D7).** Till: "Discard — a manager can see it on Orders".
- **Not a fault (D8).** "Stock value on a day" and "Balance sheet and cash
  flow" have counted as opened since step 6 (21 October); the finding was
  wrong.
- **Fixed (D9).** docs/CALCULATIONS.md: the waste alert reads 5300 and 5310.
- **Fixed (D10).** The install guides said nothing is saved offline; quick
  sales are kept and sent when the internet is back.
