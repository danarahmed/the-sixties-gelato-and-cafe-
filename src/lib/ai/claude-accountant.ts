import "server-only";

/**
 * Claude-backed accountant. Implements the same `AIAccountant` interface as the
 * deterministic stand-in, so the rest of the application is unchanged.
 *
 * The model NEVER does arithmetic and never moves money. It classifies an
 * expense to an account and reviews a period in words. Every figure it is shown
 * was computed by the tested engine, and every entry it leads to is built and
 * balanced by that engine before the database will accept it.
 */
import Anthropic from "@anthropic-ai/sdk";
import { jsonSchemaOutputFormat } from "@anthropic-ai/sdk/helpers/json-schema";
import type {
  AIAccountant,
  CloseReview,
  CloseReviewInput,
  ExpenseCategorization,
} from "@/lib/ai/accountant";

/** The chart of accounts the model may classify an expense into. */
const EXPENSE_ACCOUNTS = [
  ["5100", "Platform commission"],
  ["5200", "Platform fees"],
  ["5300", "Waste & spoilage"],
  ["6000", "Rent"],
  ["6100", "Salaries"],
  ["6200", "Utilities"],
  ["6300", "Cash over / short"],
] as const;

const ACCOUNT_CODES = EXPENSE_ACCOUNTS.map(([code]) => code);

/** What the model must return when classifying an expense. */
const CATEGORIZATION_SCHEMA = {
  type: "object",
  properties: {
    accountCode: {
      type: "string",
      enum: ["5100", "5200", "5300", "6000", "6100", "6200", "6300"],
      description: "GL account code the expense belongs to",
    },
    confidence: {
      type: "number",
      description: "How certain the classification is, between 0 and 1",
    },
    explanation: {
      type: "string",
      description: "One short sentence a shop owner would understand, naming the account",
    },
  },
  required: ["accountCode", "confidence", "explanation"],
  additionalProperties: false,
} as const;

/** What the model must return when reviewing a period close. */
const CLOSE_REVIEW_SCHEMA = {
  type: "object",
  properties: {
    readyToClose: {
      type: "boolean",
      description: "True only when nothing is left unposted and the ledger ties",
    },
    narrative: {
      type: "string",
      description: "Two or three sentences summarising the period in a bookkeeper's plain voice",
    },
    flags: {
      type: "array",
      items: { type: "string" },
      description: "Specific things to look at before locking. Empty if there are none.",
    },
  },
  required: ["readyToClose", "narrative", "flags"],
  additionalProperties: false,
} as const;

const SYSTEM = `You are the bookkeeper for a gelato café in Erbil, Iraq. The books are kept in Iraqi Dinar (IQD) on a double-entry ledger.

Rules you must follow:
- You never perform arithmetic. Every figure you are given has already been computed by the accounting engine; repeat figures exactly as given and never recompute, adjust, or estimate them.
- You never decide to move money. You classify and you advise; a person approves.
- You write plainly, the way a careful bookkeeper speaks to a shop owner. No jargon for its own sake, no flattery, no hedging.
- If something is genuinely unclear, say so and lower your confidence rather than guessing.`;

function accountName(code: string): string {
  return EXPENSE_ACCOUNTS.find(([c]) => c === code)?.[1] ?? "Utilities";
}

const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-5";

export class ClaudeAIAccountant implements AIAccountant {
  readonly providerName = "anthropic";
  readonly isMock = false;
  private client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async categorizeExpense(description: string, amount: number): Promise<ExpenseCategorization> {
    const accountList = EXPENSE_ACCOUNTS.map(([c, n]) => `  ${c} — ${n}`).join("\n");
    const response = await this.client.messages.parse({
      model: MODEL,
      max_tokens: 2000,
      system: SYSTEM,
      thinking: { type: "adaptive" },
      output_config: { effort: "low", format: jsonSchemaOutputFormat(CATEGORIZATION_SCHEMA) },
      messages: [
        {
          role: "user",
          content: `Classify this café expense to one account.

Narration: "${description}"
Amount: ${Math.round(amount).toLocaleString()} IQD

Available accounts:
${accountList}

Pick the single best account. If the narration does not clearly indicate one, choose the closest and set confidence below 0.5 so a person reviews it.`,
        },
      ],
    });

    const parsed = response.parsed_output;
    if (!parsed) throw new Error("The model did not return a usable classification");

    const name = accountName(parsed.accountCode);
    return {
      accountCode: parsed.accountCode,
      accountName: name,
      confidence: parsed.confidence,
      explanation: parsed.explanation,
      needsReview: parsed.confidence < 0.6,
    };
  }

  async reviewClose(input: CloseReviewInput): Promise<CloseReview> {
    const iqd = (n: number) => `${Math.round(n).toLocaleString()} IQD`;
    const response = await this.client.messages.parse({
      model: MODEL,
      max_tokens: 4000,
      system: SYSTEM,
      thinking: { type: "adaptive" },
      output_config: { effort: "high", format: jsonSchemaOutputFormat(CLOSE_REVIEW_SCHEMA) },
      messages: [
        {
          role: "user",
          content: `Review whether the period ${input.periodName} is ready to be closed and locked.

These figures come from the ledger and are final — quote them, do not recompute:
- Net revenue: ${iqd(input.revenue)}
- Cost of goods sold: ${iqd(input.cogs)}
- Other operating expenses: ${iqd(input.otherExpenses)}
- Waste and spoilage: ${iqd(input.waste)}
- Net result: ${iqd(input.netProfit)} (${input.netProfit < 0 ? "a loss" : "a profit"})

Control checks:
- Purchases recorded but not yet journaled: ${input.unpostedPurchases}
- Waste movements not yet journaled: ${input.unpostedWaste}
- Trial balance agrees: ${input.trialBalanced ? "yes" : "NO"}

Set readyToClose to true only if there is nothing unposted, the trial balance agrees, and there is trading activity to close. A loss on its own does not prevent closing, but mention it. List each real problem as a separate flag.`,
        },
      ],
    });

    const parsed = response.parsed_output;
    if (!parsed) throw new Error("The model did not return a usable review");
    return {
      readyToClose: parsed.readyToClose,
      narrative: parsed.narrative,
      flags: parsed.flags,
    };
  }
}
