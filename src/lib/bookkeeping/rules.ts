/**
 * The bookkeeper's rules — the layer that sits ON TOP of the accounting engine.
 * It proposes the account an expense belongs to; a person confirms it. Whether
 * a period may close is decided by the database's closing checklist, never here.
 *
 * Everything here is deterministic and local: no external service, no API key,
 * no per-use cost, and the same input always gives the same answer. It never
 * does arithmetic and never moves money — the tested engine builds every
 * balanced entry and the database validates it at commit.
 */

export interface ExpenseCategorization {
  /** GL account code the expense should post to (e.g. "6000"). */
  accountCode: string;
  accountName: string;
  /** 0..1 — how confident the classifier is. */
  confidence: number;
  /**
   * Plain-language reason, shown to the human for approval. Each one is a
   * phrase of src/lib/i18n/phrases/books.ts, with {1}, {2}… where its values
   * go: the Expenses screen shows it in the reader's language through msg().
   */
  explanation: string;
  /** True when the model wants a human to double-check (low confidence). */
  needsReview: boolean;
}

export interface Bookkeeper {
  readonly providerName: string;
  categorizeExpense(description: string, amount: number): Promise<ExpenseCategorization>;
}

// ---------------------------------------------------------------------------
// Classification rules
// ---------------------------------------------------------------------------

interface Rule {
  keywords: string[];
  accountCode: string;
  accountName: string;
}

/**
 * Keyword → GL account. Extend this list as new kinds of expense appear.
 *
 * Only accounts an expense may post to belong here. Waste and stock losses
 * are NOT expenses to type in: they are recorded on Inventory, which takes
 * the stock out at its cost (the database refuses 5000, 5050, 5300 and 5400
 * as expense accounts for exactly that reason).
 */
const EXPENSE_RULES: Rule[] = [
  { keywords: ["rent", "lease", "landlord"], accountCode: "6000", accountName: "Rent" },
  {
    keywords: ["salary", "salaries", "wage", "wages", "payroll", "staff", "employee", "barista"],
    accountCode: "6100",
    accountName: "Salaries",
  },
  {
    keywords: [
      "electric",
      "power",
      "water",
      "gas",
      "internet",
      "wifi",
      "phone",
      "utility",
      "utilities",
      "generator",
    ],
    accountCode: "6200",
    accountName: "Utilities",
  },
  { keywords: ["commission"], accountCode: "5100", accountName: "Platform commission" },
  {
    keywords: ["talabat fee", "platform fee", "delivery fee"],
    accountCode: "5200",
    accountName: "Platform fees",
  },
];

/** Fallback when nothing matches: Other expenses, flagged for the person to confirm. */
const FALLBACK: Rule = { keywords: [], accountCode: "6900", accountName: "Other expenses" };

/** Words that mean stock was lost — which belongs on Inventory, not here. */
const STOCK_LOSS = ["waste", "spoil", "spoilage", "expired", "damaged", "thrown", "melted"];

export class RuleBookkeeper implements Bookkeeper {
  readonly providerName = "house-rules";

  async categorizeExpense(description: string, amount: number): Promise<ExpenseCategorization> {
    const text = (description || "").toLowerCase();
    const loss = STOCK_LOSS.find((k) => text.includes(k));
    if (loss) {
      return {
        accountCode: FALLBACK.accountCode,
        accountName: FALLBACK.accountName,
        confidence: 0.2,
        explanation: `“${loss}” sounds like stock that was lost. Record it on Inventory → Record waste instead, so the stock and its cost come out together. Only post it here if it really is a bought-in service.`,
        needsReview: true,
      };
    }
    const hit = EXPENSE_RULES.find((r) => r.keywords.some((k) => text.includes(k)));
    if (hit) {
      const matched = hit.keywords.find((k) => text.includes(k))!;
      return {
        accountCode: hit.accountCode,
        accountName: hit.accountName,
        confidence: 0.92,
        explanation: `Matched “${matched}” → ${hit.accountCode} ${hit.accountName} for ${Math.round(amount).toLocaleString("en-US")} IQD. Change the account if this is wrong.`,
        needsReview: false,
      };
    }
    return {
      accountCode: FALLBACK.accountCode,
      accountName: FALLBACK.accountName,
      confidence: 0.4,
      explanation: `No clear category word found, so ${FALLBACK.accountCode} ${FALLBACK.accountName} is proposed. Please choose the right account before posting.`,
      needsReview: true,
    };
  }
}

let cached: Bookkeeper | null = null;

/** The active bookkeeper. Deterministic, local, and free to run. */
export function getBookkeeper(): Bookkeeper {
  if (!cached) cached = new RuleBookkeeper();
  return cached;
}
