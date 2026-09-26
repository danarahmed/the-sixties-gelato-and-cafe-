"use server";
/**
 * The café's languages and its own words (0032, Settings → Languages): a
 * language added, renamed, taken out of use or brought back, and any phrase
 * given the café's words in any language. The database checks the person may
 * (settings.manage) and records every change on the audit trail; here the
 * words are checked against the phrase's English first, dotted keys too.
 */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { callRpc, parse, type ActionResult } from "@/lib/db/rpc";
import { text } from "@/lib/validation";
import { englishOf } from "@/lib/i18n/catalogue";

const CODE = /^[a-z]{2,3}(-[a-z0-9]{2,8})?$/;

/** Every page lists the café's languages and speaks the reader's: refresh them all. */
function refreshEveryPage() {
  revalidatePath("/", "layout");
}

const languageInput = z.object({
  code: z
    .string()
    .trim()
    .toLowerCase()
    .regex(CODE, "A language's code is two or three small Latin letters (tr, fa, kmr)"),
  name: text("The language's name", 40),
  dir: z.enum(["ltr", "rtl"], { message: "Choose which way it is written" }),
  active: z.boolean(),
});

/** Add a language, or change one the café added (its name, its direction, whether it is in use). */
export async function saveLanguageAction(
  input: z.input<typeof languageInput>,
): Promise<ActionResult<{ code: string }>> {
  const v = parse(languageInput, input);
  if (!v.ok) return v;
  const r = await callRpc("save_language", {
    p_code: v.data.code,
    p_name: v.data.name,
    p_dir: v.data.dir,
    p_active: v.data.active,
  });
  if (!r.ok) return r;
  refreshEveryPage();
  return { ok: true, data: { code: v.data.code } };
}

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
const tags = (s: string) => [...s.matchAll(/<\/?([a-z][a-z0-9]*)>/gi)].map((m) => m[0]).sort();

/**
 * The café's words for phrases in one language: { key: words }; empty words
 * give a phrase back its built-in words, or its English. Words keep every
 * {placeholder} and <mark> of the English. A key the app no longer has is
 * left out, and counted.
 */
export async function savePhrasesAction(
  locale: string,
  phrases: Record<string, string>,
): Promise<ActionResult<{ set: number; cleared: number; skipped: number }>> {
  const code = String(locale ?? "")
    .trim()
    .toLowerCase();
  if (!CODE.test(code)) return { ok: false, error: "Choose the language" };
  const entries = Object.entries(phrases ?? {});
  if (entries.length > 5000) return { ok: false, error: "Give at most 5000 phrases at a time" };
  const send: Record<string, string | null> = {};
  let skipped = 0;
  for (const [key, raw] of entries) {
    const english = englishOf(key);
    if (english === null) {
      skipped++;
      continue;
    }
    const words = String(raw ?? "").trim();
    if (!words) {
      send[key] = null;
      continue;
    }
    if (placeholders(words).join() !== placeholders(english).join()) {
      const want = placeholders(english)
        .map((p) => `{${p}}`)
        .join(" ");
      return {
        ok: false,
        error: want
          ? `Keep ${want} in the words for "${key.slice(0, 80)}", as the English has them`
          : `The English of "${key.slice(0, 80)}" has no {…}: leave them out of its words`,
      };
    }
    if (tags(words).join() !== tags(english).join())
      return {
        ok: false,
        error: `Keep the marks <…> of the English in the words for "${key.slice(0, 80)}"`,
      };
    send[key] = words;
  }
  if (!Object.keys(send).length) return { ok: true, data: { set: 0, cleared: 0, skipped } };
  const r = await callRpc<{ set?: number; cleared?: number }>("save_phrases", {
    p_locale: code,
    p_phrases: send,
  });
  if (!r.ok) return r;
  refreshEveryPage();
  return {
    ok: true,
    data: { set: Number(r.data?.set ?? 0), cleared: Number(r.data?.cleared ?? 0), skipped },
  };
}
