# Selling the system to other cafés: the plan

Written 4 November 2026 from the owner's question "what about selling plan".
Nothing here is started; each part waits for the owner's word. Supabase
(the hosting and its plan) is the owner's to decide, and is talked about
when the owner is ready.

## The five questions

### 1. Each café's own data (the most important)

Where each customer café's records live, so that no café can ever see
another's.

- **Now:** the database already keeps cafés apart: every record belongs to a
  café, and the rules stop one café reading another's. Practice (0096) proves
  it: each practice café is a real separate café in the same database.
- **The choice:**
  - one shared system for every café: cheaper, one update for all, but a
    problem touches everyone;
  - a separate copy for each café: fully separate and safest, more work per
    customer.
- **Recommended:** a separate copy for the first few customers, safest while
  learning; it can become one shared system later.

### 2. A new café setting itself up without you

From nothing to selling, alone.

- **Now:** much is there: the café's details and places on Settings, the setup
  checklist on the Dashboard, pasting a menu, Practice, the ? help, the tours
  and the videos.
- **Missing:**
  - a "create your café" sign-up for a brand-new owner (today a café is
    created in the database);
  - a ready starter menu they can change;
  - removing what is The Sixty's own.

### 3. Your brand, and theirs

Whose name is on the app.

- **Now:** the app carries "The Sixty's" in places (its name, the mark, the
  colours).
- **The choice:**
  - a neutral product name with each café's own logo (the receipt already
    prints each café's logo);
  - or keep your brand and sell it as yours.

### 4. How you charge

- **The choices:**
  - a monthly fee per café, possibly more with more branches;
  - a one-time price plus a yearly fee for support;
  - a free trial, for example 30 days.
- **Then the system needs** to know each café's plan and payment, and to
  limit a café whose payment has stopped.

### 5. Support and responsibility

- **The question:** who answers when a customer's till stops at 9 pm, and who
  is responsible for their data.
- **What is needed:**
  - a way for customers to reach you (the app already has "Something's
    wrong?" reports);
  - updates that do not break their café;
  - backups (with Supabase, later);
  - simple terms of use and a privacy promise.

## Recommended order

1. Decide questions 1, 3 and 4 together: they shape everything else.
2. Sell to one or two friendly cafés at a low price, and learn from them.
3. Build what they show is missing (most likely the sign-up of question 2),
   then sell more widely.

## Plans for small and big cafés: one system, parts switched per café (6 November 2026)

Nothing is removed and no "small version" is ever built or kept apart. Every
café runs the same app and the same database; a small café has some parts
switched off. (Not built yet: there are no plans or feature switches today.)

**How it works:**
1. **One system, one code, for everyone.**
2. **Each café has a plan** (for example Starter, Complete, Business), and a list
   says which parts each plan includes:

   | Part | Starter | Complete | Business |
   |---|---|---|---|
   | Till, menu, tables, offline sales | ✅ | ✅ | ✅ |
   | Stock, counts, daily reports, help, practice | ✅ | ✅ | ✅ |
   | Recipes and costing, production, use-by | – | ✅ | ✅ |
   | Purchasing and suppliers | – | ✅ | ✅ |
   | Staff, clock-in, payroll | – | ✅ | ✅ |
   | Full accounting screens (journals, bank, balance sheet) | – | ✅ | ✅ |
   | Several branches, central kitchen, transfers | – | – | ✅ |
   | Priority support, on-site setup | – | – | ✅ |

3. **Switched off in two places:** the screens do not show what the plan does
   not include (a simpler app, easier to learn), and the database refuses those
   functions for that café, the same way it already refuses a cashier a
   manager's work, so nothing is unlocked without paying.
4. **Upgrading is one click:** the owner changes the café's plan and the new
   parts appear at once; nothing installed, nothing lost.

**The books still run underneath.** A Starter café does not see the accounting
screens, but every sale, delivery and count still posts its journals, as now.
So an upgraded café has its whole history from day one; its simple reports stay
right, since they read the same complete records; and a downgrade loses
nothing (the hidden parts become hidden or read-only, and return on upgrade).

**Another way to divide plans:** by size (branches, tills, how far back reports
go). Recommended: by parts *and* by branches, as in the table, since a small
café does not need payroll or a central kitchen, and a simpler app suits it.

**What it takes to build (a moderate job, not a rebuild):**
- a plan on each café, and the list of what each plan includes;
- the menus and pages reading that list;
- the database checking it, in the same place it already checks permissions;
- a screen in the owner's admin console (plan 9) to change a café's plan.
