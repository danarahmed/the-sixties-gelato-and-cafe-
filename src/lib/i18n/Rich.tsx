/**
 * A translated sentence with some of its words marked, so it is translated
 * whole and each language keeps its own word order:
 *
 *   <Rich text={t("The sale sits in <b>1100 Platform receivable</b> until it is paid out.")} />
 *   <Rich text={t("See the <guide>Talabat guide</guide>.")}
 *         tags={{ guide: (c) => <Link href="/help/talabat">{c}</Link> }} />
 *
 * <b> and <strong> are bold, <em> and <i> italic, <code> code; any other tag
 * is one the caller names. A tag nobody names is shown as its words only.
 * Works in server and browser components alike.
 */
import { Fragment, type ReactNode } from "react";

export type TagRenderers = Record<string, (children: ReactNode) => ReactNode>;

const BUILT_IN: TagRenderers = {
  b: (c) => <strong>{c}</strong>,
  strong: (c) => <strong>{c}</strong>,
  em: (c) => <em>{c}</em>,
  i: (c) => <em>{c}</em>,
  code: (c) => <code>{c}</code>,
};

interface Node {
  tag: string | null;
  children: (Node | string)[];
}

/** The sentence as a tree of its marked parts; an unmatched closing tag is text. */
export function parseRich(text: string): Node {
  const root: Node = { tag: null, children: [] };
  const stack: Node[] = [root];
  const re = /<(\/?)([a-z][a-z0-9]*)>/gi;
  let last = 0;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    const top = stack[stack.length - 1]!;
    if (m.index > last) top.children.push(text.slice(last, m.index));
    last = m.index + m[0].length;
    const name = m[2]!.toLowerCase();
    if (m[1] === "/") {
      if (stack.length > 1 && top.tag === name) stack.pop();
      else top.children.push(m[0]);
    } else {
      const node: Node = { tag: name, children: [] };
      top.children.push(node);
      stack.push(node);
    }
  }
  if (last < text.length) stack[stack.length - 1]!.children.push(text.slice(last));
  return root;
}

function render(node: Node | string, tags: TagRenderers, key: number): ReactNode {
  if (typeof node === "string") return node;
  const inner = node.children.map((c, i) => render(c, tags, i));
  const as = node.tag ? (tags[node.tag] ?? BUILT_IN[node.tag]) : undefined;
  return <Fragment key={key}>{as ? as(<>{inner}</>) : inner}</Fragment>;
}

export function Rich({ text, tags = {} }: { text: string; tags?: TagRenderers }) {
  return <>{render(parseRich(text), tags, 0)}</>;
}

/** The sentence's words alone, its marks taken out: for a title, an aria-label, a CSV. */
export function plain(text: string): string {
  return text.replace(/<\/?[a-z][a-z0-9]*>/gi, "");
}
