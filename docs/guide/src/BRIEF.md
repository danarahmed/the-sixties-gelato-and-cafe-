# The screen reference: how each screen's entry is written

The owner asked for a guide that tells **everything that can happen on each
screen**, not only what the screen has. Each entry is written from the code
(the page, the components it renders, the server actions it calls, and the
database functions behind them), never from memory or guesswork.

## Readers

Café staff and the owner, in Erbil. English is not their first language:
short sentences, plain words, no jargon ("the books" not "general ledger"
unless the screen says it). Name buttons and labels **exactly as the screen
shows them in English** (resolve `t("...")` keys to the English text; the
English for `nav.*` and other keys is in `src/lib/i18n/`).

## What to read

- The page: `src/app/<route>/page.tsx` and every component it renders
  (follow imports into `src/components/`), including client components,
  dialogs, sheets, confirmations and toasts.
- What it calls: `src/lib/actions/*.ts` (server actions) and `src/lib/db/*.ts`
  (reads), and the database functions they call by `rpc("...")`.
- The database's messages, by function: `docs/guide/src/db-messages-by-function.tsv`
  (function name, tab, message; `{1}` is where a value goes). For each
  function a screen calls, every message it can raise belongs to that screen.
- Who may open it: `src/lib/auth/routes.ts` (the menu), the page's own
  `require…` checks, and `docs/guide/src/role-permissions.tsv` (roles and
  their permissions). Roles: owner, general_manager, branch_manager, cashier,
  barista, inventory_counter, purchasing, accountant, auditor.
- The browser tests in `tests/e2e/*.e2e.mjs` show real flows and states.
- How the numbers are worked out: `docs/CALCULATIONS.md`, `docs/DATA_MODEL.md`.

## The entry (JSON, one object per screen)

```json
{
  "path": "/pos",
  "title": "Till",                      // the heading as shown
  "area": "Selling",
  "summary": "One or two sentences: what this screen is for.",
  "who": [                               // who can open it and what differs
    {"role": "cashier", "can": "sell, take payment, ...", "cannot": "give discounts above 10% without a manager's PIN"}
  ],
  "get_there": "Menu → Operations → Till. Also: ...",
  "before": ["What must be true or set up first (e.g. a drawer open)."],
  "parts": [                             // every part of the screen, top to bottom
    {
      "name": "Cart",
      "shows": "What it shows, and where each number comes from.",
      "controls": [                      // every button, box, list, toggle, link, shortcut
        {
          "label": "Pay",               // exact English text or icon's name
          "kind": "button",             // button | box | list | toggle | link | tab | key | tile
          "does": "What happens when used, step by step.",
          "rules": "Limits, required, defaults, formats (e.g. 1 to 92 days).",
          "who": "Only if not everyone on the screen can use it.",
          "after": "What changes elsewhere: stock, the safe, the bank, the books, a report, the audit trail."
        }
      ]
    }
  ],
  "states": [                            // every way the screen can look
    {"state": "Empty (no products yet)", "looks": "What is shown and what to do."}
  ],
  "messages": [                          // EVERY message the screen can show
    {
      "text": "Exact English text, with {name} where a value goes",
      "kind": "error | warning | confirm | info | success",
      "when": "What causes it.",
      "do": "What to do about it."
    }
  ],
  "what_if": [                           // real situations and what to do
    {"case": "The customer changes their mind after paying", "do": "Steps."}
  ],
  "tips": ["Shortcuts, faster ways, things people often miss."],
  "related": ["/orders", "/end-of-day"],
  "shots": [                             // screenshots worth taking for this entry
    {"name": "pos-cart", "role": "cashier", "state": "A cart with two items and an add-on", "setup": "How to get there (clicks or data)."}
  ]
}
```

## Rules

- **Complete:** every control, every state, every message. A message that
  only some roles can hit still counts (say who). Messages that are purely
  technical and cannot reach a person through this screen may be skipped,
  but say so in `"skipped_messages"` with the reason.
- **Exact:** labels and messages as the English screen shows them. If the
  text is built from parts, give the whole sentence with `{placeholders}`.
- **True:** only what the code does. If unsure, read more code; if still
  unsure, add `"open_questions": ["..."]` rather than guess.
- **After-effects matter:** say what a press does to stock, money (till,
  safe, bank, card money), the books, and who is told.
- **One file per area:** write `docs/guide/src/screens/<area-key>.json` as a
  JSON array of entries, valid JSON (no comments).
