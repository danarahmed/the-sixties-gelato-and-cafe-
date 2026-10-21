/**
 * A page's explanation split into its first sentence, always shown, and the
 * rest, folded under "How this works". The sentence ends at a full stop,
 * question or exclamation mark followed by a space (or at the end), outside
 * any marked words, so "<b>Blind count.</b> Count what is…" keeps its bold
 * whole. Arabic and Kurdish end their sentences the same way (and with ؟).
 */
export function splitLead(text: string): { lead: string; rest: string } {
  let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === "<") {
      const close = text.indexOf(">", i);
      if (close < 0) break;
      const tag = text.slice(i + 1, close);
      if (/^\/[a-z]/i.test(tag)) depth = Math.max(0, depth - 1);
      else if (/^[a-z]/i.test(tag) && !tag.endsWith("/")) depth++;
      i = close;
      continue;
    }
    if (depth === 0 && (c === "." || c === "?" || c === "!" || c === "؟")) {
      const next = text[i + 1];
      if (next === undefined) return { lead: text, rest: "" };
      if (next === " " || next === "\n") {
        return { lead: text.slice(0, i + 1), rest: text.slice(i + 2).trim() };
      }
    }
  }
  return { lead: text, rest: "" };
}
