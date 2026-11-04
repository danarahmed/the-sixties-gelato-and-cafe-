"use server";
/** The ? help (G3): the open screen's help, for the person's roles, in their language. */
import { getSession } from "@/lib/auth/session";
import { getLocale } from "@/lib/i18n/server";
import { english, helpIn } from "@/lib/help/content";
import { helpFor, type HelpForScreen } from "@/lib/help/match";
import { callRpc } from "@/lib/db/rpc";

export async function helpForAction(pathname: string): Promise<HelpForScreen | null> {
  if (typeof pathname !== "string" || !pathname.startsWith("/") || pathname.length > 200)
    return null;
  const s = await getSession();
  if (!s.profile) return null;
  const [locale] = await Promise.all([
    getLocale(),
    // Where people get stuck (0097): a help opened is noted; nothing before 0097.
    callRpc("note_stuck", { p_path: pathname, p_kind: "help" }).catch(() => null),
  ]);
  return helpFor(pathname, s.profile.roles, english, await helpIn(locale));
}
