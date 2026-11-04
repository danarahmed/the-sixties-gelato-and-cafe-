/**
 * Show me around (round six): a short guided tour of the till, Production and
 * the dashboard, for someone new to them. Each step points at a part of the
 * screen — the first of its places that is shown, so a step whose part a
 * person's role does not show, or the page does not hold yet, falls back to
 * the next, or is passed over — and says in a sentence what it is for. The
 * words are phrases in the books, shown through t(). Pure: the tour and the
 * tests read through here.
 */

export interface TourStep {
  /** Where it points: CSS selectors, the first one shown on the page wins. */
  at: readonly string[];
  title: string;
  text: string;
}

export interface Tour {
  /** Kept per device once seen: "tour:" and this. */
  key: string;
  /** The page it is for. */
  path: string;
  steps: readonly TourStep[];
}

export const TOURS: readonly Tour[] = [
  {
    key: "pos",
    path: "/pos",
    steps: [
      {
        at: ['.pos-main input[type="search"]'],
        title: "Find it fast",
        text: "Type a name to find a product: Enter adds the one lit, and a number typed first adds that many. ? lists every key.",
      },
      {
        at: [".pos-main"],
        title: "Tap to add",
        text: "Tap a product to add it to the order. One with sizes or add-ons asks which, then adds it. On Tables, tap a table to open its bill.",
      },
      {
        at: [".pos .bill-strip"],
        title: "The orders in hand",
        text: "A quick sale, and every bill still open: tap one to carry on with it.",
      },
      {
        at: [".pos-side .channel-tabs"],
        title: "Where it goes",
        text: "To eat in, to take away, or through a delivery platform: the prices follow the choice.",
      },
      {
        at: [".pos-side .order-actions", ".pos-side"],
        title: "Take the money",
        text: "Change a quantity, add a note, or give a discount with its reason; then cash or card. The receipt prints itself if the till is set to.",
      },
      {
        at: ['[data-testid="drawer-button"]'],
        title: "The drawer",
        text: "Open it with the money it starts with, and count it when it closes: the till says what it should hold.",
      },
      {
        at: ['[data-testid="clock-button"]'],
        title: "Clock in and out",
        text: "Each person clocks in and out here, with their name and PIN.",
      },
    ],
  },
  {
    key: "production",
    path: "/production",
    steps: [
      {
        at: ['[data-testid="plan"]'],
        title: "What to make today",
        text: "The day's plan: what sells on this weekday, what is in stock, and so how many batches of each to make.",
      },
      {
        at: ['[data-testid="plan-all"]'],
        title: "The plan in one go",
        text: "Record every batch the plan says in one press, changing what came out where it differs; then print every label.",
      },
      {
        at: ["#record"],
        title: "Record a batch",
        text: "Choose what you made and how many batches: its ingredients come out of stock, and what came out goes in, with its use-by.",
      },
      {
        at: ['[data-testid="lots-panel"]', "#lots"],
        title: "What is in stock",
        text: "Each batch still in stock, the one to use first at the top, with its use-by.",
      },
      {
        at: [".pr-recipes"],
        title: "Its recipes",
        text: "What you make and what goes into it: change a recipe when the way it is made changes.",
      },
    ],
  },
  {
    key: "dashboard",
    path: "/dashboard",
    steps: [
      {
        at: ['section[aria-labelledby="dash-today"]'],
        title: "Today at a glance",
        text: "Today's figures, each against a usual day: open one to see what is behind it.",
      },
      {
        at: ["#needs-you"],
        title: "What needs you",
        text: "What waits for an answer: the red ones first.",
      },
      {
        at: [".dash-say"],
        title: "What the figures say",
        text: "The day in words, each with where to act on it.",
      },
      {
        at: [".dash-main"],
        title: "The days behind it",
        text: "The last two weeks of sales, and what sells.",
      },
      {
        at: ["#sidenav", ".menu-toggle"],
        title: "Everything else",
        text: "Every other screen is in the menu: the till, the stock, the reports.",
      },
    ],
  },
  // Everyone's first screen (G1), and the rest of the roles' own (G3).
  {
    key: "today",
    path: "/today",
    steps: [
      {
        at: ['[data-testid="today-practice"]'],
        title: "New here? Practise first",
        text: "Try your work in a practice café of your own: nothing you do there is real.",
      },
      {
        at: ['[data-testid="today-progress"]'],
        title: "Your day",
        text: "How many of today's jobs are done. When all are, it says so.",
      },
      {
        at: [".today-job"],
        title: "One job, one button",
        text: "Each job of your role, in the order of the day. Its button goes straight to where it is done.",
      },
      {
        at: ['[data-testid="help-button"]'],
        title: "Help on every screen",
        text: "Press ? on any screen: what it is for, what you can do there, and your tasks on it step by step.",
      },
      {
        at: ["#sidenav", ".menu-toggle"],
        title: "Everything else",
        text: "Every other screen is in the menu: the till, the stock, the reports.",
      },
    ],
  },
  {
    key: "count",
    path: "/count",
    steps: [
      {
        at: ['[data-testid="counts-table"]'],
        title: "The counts",
        text: "Each count: who counted, when, and whether it waits for review. Start a count, type what is on the shelf, and send it.",
      },
      {
        at: ['[data-testid="help-button"]'],
        title: "Help on every screen",
        text: "Press ? on any screen: what it is for, what you can do there, and your tasks on it step by step.",
      },
    ],
  },
  {
    key: "purchasing",
    path: "/purchasing",
    steps: [
      {
        at: ['[data-testid="buying-link"]'],
        title: "What to buy",
        text: "The items running low, with how much to order from whom.",
      },
      {
        at: ['[data-testid="po-form"]'],
        title: "Order",
        text: "An order to a supplier: approve it, then send it.",
      },
      {
        at: ['[data-testid="receive"]'],
        title: "Receive",
        text: "What the supplier brought, line by line, with its prices: the stock and the books follow.",
      },
      {
        at: ['[data-testid="help-button"]'],
        title: "Help on every screen",
        text: "Press ? on any screen: what it is for, what you can do there, and your tasks on it step by step.",
      },
    ],
  },
  {
    key: "reports",
    path: "/reports",
    steps: [
      {
        at: ['[data-testid="reports-learned"]', "#g-sales"],
        title: "The reports",
        text: "Each report in a word; the ones you open most come first.",
      },
      {
        at: ["#pnl"],
        title: "Profit and loss",
        text: "What came in and what it cost for the dates chosen: open a figure to see what is behind it.",
      },
      {
        at: ["#reconciliation"],
        title: "Do the books tie?",
        text: "The books checked against the till, the drawer and the stock: every line should be ticked.",
      },
      {
        at: ['[data-testid="help-button"]'],
        title: "Help on every screen",
        text: "Press ? on any screen: what it is for, what you can do there, and your tasks on it step by step.",
      },
    ],
  },
  {
    key: "practice",
    path: "/practice",
    steps: [
      {
        at: ['[data-testid="practice-start"]'],
        title: "Practise",
        text: "A practice café of your own: the same screens, pretend money and stock. Nothing there reaches the books.",
      },
      {
        at: ['[data-testid="practice-tasks"]'],
        title: "Your tasks",
        text: "Your role's tasks, in order: each is ticked once you have done it in practice.",
      },
      {
        at: ['[data-testid="practice-team"]'],
        title: "Your team's practice",
        text: "Who has practised, and who is ready.",
      },
    ],
  },
];

/** The tour for a page, if it has one. */
export function tourFor(path: string | null | undefined): Tour | null {
  return TOURS.find((t) => t.path === path) ?? null;
}

/** Every word the tours give a screen: each is a phrase in the books. */
export const TOUR_PHRASES: readonly string[] = [
  ...TOURS.flatMap((t) => t.steps.flatMap((s) => [s.title, s.text])),
  "Show me around",
  "Show me around this screen",
  "New here? Let us show you around this screen.",
  "No thanks",
  "Step {n} of {total}",
  "Back",
  "Next",
  "Finish",
  "End the tour",
];
