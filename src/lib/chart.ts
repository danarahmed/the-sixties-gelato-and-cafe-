/**
 * The chart of accounts (0058): the codes an account the café adds may have,
 * as the database checks them. The reports place an account by its kind and
 * its code: 4… is income, 5… the cost of what was sold, 6… the running costs.
 */
export const ACCOUNT_RANGE: Record<"revenue" | "expense", [number, number]> = {
  revenue: [4000, 4999],
  expense: [5000, 6999],
};

/**
 * The code proposed for a new account: the first free one of ten from the
 * kind's own first (4300 for an income, 6010 for a running cost), else the
 * first free one of its range, else none.
 */
export function nextFreeCode(accounts: { code: string }[], type: "revenue" | "expense"): string {
  const [from, to] = ACCOUNT_RANGE[type];
  const taken = new Set(accounts.map((a) => a.code));
  const start = type === "revenue" ? 4300 : 6010;
  for (let c = start; c <= to; c += 10) if (!taken.has(String(c))) return String(c);
  for (let c = from; c <= to; c++) if (!taken.has(String(c))) return String(c);
  return "";
}
