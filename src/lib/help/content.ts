import "server-only";
/** The ? help's content in each language; a language not translated yet shows English. */
import en from "./en.json";
import type { HelpContent } from "./match";

const local: Record<string, () => Promise<HelpContent>> = {
  ar: async () => (await import("./ar.json")).default as unknown as HelpContent,
  ckb: async () => (await import("./ckb.json")).default as unknown as HelpContent,
};

export const english = en as unknown as HelpContent;

export async function helpIn(locale: string): Promise<HelpContent | null> {
  const load = local[locale];
  if (!load) return null;
  try {
    return await load();
  } catch {
    return null;
  }
}
