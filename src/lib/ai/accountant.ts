/**
 * AI Accountant — the reasoning layer that sits ON TOP of the deterministic
 * accounting engine. It NEVER does arithmetic or moves money itself; it only
 * classifies, explains, and reviews. The engine builds and the database
 * validates every balanced entry.
 *
 * `MockAIAccountant` is a deterministic stand-in (no API key, no network) so the
 * whole auto-draft + human-approved-close flow is real and testable today.
 * Swapping in a real Claude-backed implementation is a one-file change behind
 * this same interface (see `getAIAccountant`).
 */

export interface ExpenseCategorization {
  /** GL account code the expense should post to (e.g. "6000"). */
  accountCode: string;
  accountName: string;
  /** 0..1 — how confident the classifier is. */
  confidence: number;
  /** Plain-language reason, shown to the human for approval. */
  explanation: string;
  /** True when the model wants a human to double-check (low confidence). */
  needsReview: boolean;
}

export interface CloseReviewInput {
  periodName: string;
  revenue: number;
  cogs: number;
  otherExpenses: number;
  waste: number;
  netProfit: number;
  unpostedPurchases: number;
  unpostedWaste: number;
  trialBalanced: boolean;
}

export interface CloseReview {
  /** Whether the accountant judges the period ready to lock. */
  readyToClose: boolean;
  /** Human-readable narrative summarising the month. */
  narrative: string;
  /** Anything the human should look at before approving. */
  flags: string[];
}

export interface AIAccountant {
  readonly providerName: string; // 'mock' | 'anthropic'
  readonly isMock: boolean;
  categorizeExpense(description: string, amount: number): Promise<ExpenseCategorization>;
  reviewClose(input: CloseReviewInput): Promise<CloseReview>;
}

// ---------------------------------------------------------------------------
// Deterministic mock brain
// ---------------------------------------------------------------------------

interface Rule {
  keywords: string[];
  accountCode: string;
  accountName: string;
}

/** Keyword → GL account rules mirroring what the real model would output. */
const EXPENSE_RULES: Rule[] = [
  { keywords: ["rent", "lease", "landlord"], accountCode: "6000", accountName: "Rent" },
  {
    keywords: ["salary", "salaries", "wage", "wages", "payroll", "staff", "employee", "barista"],
    accountCode: "6100",
    accountName: "Salaries",
  },
  {
    keywords: ["electric", "power", "water", "gas", "internet", "wifi", "phone", "utility", "utilities", "bill"],
    accountCode: "6200",
    accountName: "Utilities",
  },
  {
    keywords: ["commission", "talabat fee", "platform fee"],
    accountCode: "5200",
    accountName: "Platform fees",
  },
  {
    keywords: ["waste", "spoil", "spoilage", "expired", "damaged", "thrown"],
    accountCode: "5300",
    accountName: "Waste & spoilage",
  },
];

/** Fallback when nothing matches: operating expense, flagged for review. */
const FALLBACK: Rule = { keywords: [], accountCode: "6200", accountName: "Utilities" };

export class MockAIAccountant implements AIAccountant {
  readonly providerName = "mock";
  readonly isMock = true;

  async categorizeExpense(description: string, amount: number): Promise<ExpenseCategorization> {
    const text = (description || "").toLowerCase();
    const hit = EXPENSE_RULES.find((r) => r.keywords.some((k) => text.includes(k)));
    if (hit) {
      const matched = hit.keywords.find((k) => text.includes(k))!;
      return {
        accountCode: hit.accountCode,
        accountName: hit.accountName,
        confidence: 0.92,
        explanation: `Matched “${matched}” → ${hit.accountCode} ${hit.accountName}. Posts Dr ${hit.accountName}, Cr Cash for ${Math.round(amount).toLocaleString()} IQD.`,
        needsReview: false,
      };
    }
    return {
      accountCode: FALLBACK.accountCode,
      accountName: FALLBACK.accountName,
      confidence: 0.4,
      explanation: `No clear category keyword found; defaulted to ${FALLBACK.accountCode} ${FALLBACK.accountName}. Please confirm the account before posting.`,
      needsReview: true,
    };
  }

  async reviewClose(input: CloseReviewInput): Promise<CloseReview> {
    const flags: string[] = [];
    if (input.unpostedPurchases > 0)
      flags.push(`${input.unpostedPurchases} purchase(s) not yet journaled — run auto-post first.`);
    if (input.unpostedWaste > 0)
      flags.push(`${input.unpostedWaste} waste movement(s) not yet journaled — run auto-post first.`);
    if (!input.trialBalanced) flags.push("Trial balance does not tie out (debits ≠ credits).");
    if (input.revenue === 0) flags.push("No sales recorded this period — nothing to close.");
    if (input.netProfit < 0)
      flags.push(`Period shows a net loss of ${Math.abs(Math.round(input.netProfit)).toLocaleString()} IQD — review costs.`);

    const readyToClose = flags.filter((f) => !f.startsWith("Period shows a net loss")).length === 0 && input.revenue > 0;

    const marginPct = input.revenue > 0 ? ((input.revenue - input.cogs) / input.revenue) * 100 : 0;
    const narrative =
      `${input.periodName}: revenue ${Math.round(input.revenue).toLocaleString()} IQD, ` +
      `COGS ${Math.round(input.cogs).toLocaleString()} (gross margin ${marginPct.toFixed(1)}%), ` +
      `other expenses ${Math.round(input.otherExpenses + input.waste).toLocaleString()}, ` +
      `net ${Math.round(input.netProfit).toLocaleString()} IQD. ` +
      (readyToClose
        ? "All routine entries are posted and the ledger balances. Ready for your approval to lock the period."
        : "Resolve the flags below before locking the period.");

    return { readyToClose, narrative, flags };
  }
}

let cached: AIAccountant | null = null;

/**
 * Returns the active accountant: Claude when `ANTHROPIC_API_KEY` is configured
 * on the server, the deterministic stand-in otherwise. The application never
 * needs to know which one it got — both honour the same contract, and the
 * engine builds and balances every entry either way.
 *
 * The Claude implementation is imported dynamically so the SDK is only ever
 * loaded on the server, and only when a key is actually present.
 */
export async function getAIAccountant(): Promise<AIAccountant> {
  if (cached) return cached;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (apiKey) {
    try {
      const { ClaudeAIAccountant } = await import("@/lib/ai/claude-accountant");
      cached = new ClaudeAIAccountant(apiKey);
      return cached;
    } catch {
      // Fall through to the stand-in rather than break bookkeeping.
    }
  }
  cached = new MockAIAccountant();
  return cached;
}
