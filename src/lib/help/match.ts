/**
 * The ? help (G3): which of the guide's entries belong to the screen open
 * now, and what of them is for this person's role. Pure: the panel and the
 * tests read through here. The content is src/lib/help/{en,ar,ckb}.json,
 * taken from the guide by scripts/help/extract.mjs.
 */

export interface HelpScreen {
  path: string;
  title: string;
  summary: string;
  get_there: string;
  /** What each role may do there; some keys are words for everyone ("anyone"). */
  who: Record<string, string>;
  what_if: { case: string; do: string }[];
  tips: string[];
}

export interface HelpTask {
  id: number;
  title: string;
  roles: string[];
  when: string;
  why: string;
  before: string[];
  steps: { do: string; see?: string }[];
  if: { case: string; do: string }[];
  screens: string[];
}

export interface HelpContent {
  screens: HelpScreen[];
  tasks: HelpTask[];
}

/** A guide path as the screen it names: "/inventory/[itemId]#x?y" → /inventory/*. */
export function screenPattern(path: string): RegExp | null {
  if (!path.startsWith("/")) return null;
  const bare = path.replace(/[?#].*$/, "").replace(/\/+$/, "") || "/";
  const re = bare
    .split("/")
    .map((part) => (/^\[.+\]$/.test(part) ? "[^/]+" : part.replace(/[.*+?^${}()|\\]/g, "\\$&")))
    .join("/");
  return new RegExp(`^${re}$`);
}

/** The address of the screen open now, without its query or anchor. */
export const barePath = (pathname: string) =>
  pathname.replace(/[?#].*$/, "").replace(/\/+$/, "") || "/";

const EVERYONE = /^(anyone|every|everyone|others)/;

export interface HelpForScreen {
  screens: {
    title: string;
    summary: string;
    get_there: string;
    /** What this person may do there, by their roles. */
    you: string[];
    what_if: { case: string; do: string }[];
    tips: string[];
  }[];
  tasks: HelpTask[];
}

/**
 * The entries for a screen, in the person's language where it has them:
 * each part of the screen, what their roles may do there, and the tasks of
 * their roles that use it. Entries are matched in English and shown in
 * translation, entry by entry (the translations keep the same order).
 */
export function helpFor(
  pathname: string,
  roles: readonly string[],
  en: HelpContent,
  local: HelpContent | null,
): HelpForScreen {
  const at = barePath(pathname);
  const matches = (p: string) => screenPattern(p)?.test(at) ?? false;
  const pick = <T>(list: "screens" | "tasks", i: number, english: T): T =>
    ((local?.[list]?.[i] as T | undefined) ?? english) as T;
  const screens = en.screens
    .map((s, i) => [s, i] as const)
    .filter(([s]) => matches(s.path))
    .map(([s, i]) => {
      const shown = pick("screens", i, s);
      const keys = Object.keys(s.who);
      const mine = keys.filter((k) => roles.includes(k));
      const said = (mine.length ? mine : keys.filter((k) => EVERYONE.test(k))).map(
        (k) => shown.who[k] ?? s.who[k]!,
      );
      return {
        title: shown.title,
        summary: shown.summary,
        get_there: shown.get_there,
        you: [...new Set(said)],
        what_if: shown.what_if,
        tips: shown.tips,
      };
    });
  const tasks = en.tasks
    .map((t, i) => [t, i] as const)
    .filter(([t]) => t.roles.some((r) => roles.includes(r)) && t.screens.some(matches))
    .map(([t, i]) => pick("tasks", i, t));
  return { screens, tasks };
}
