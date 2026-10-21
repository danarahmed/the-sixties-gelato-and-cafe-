import type { ReactNode } from "react";
import { Rich, type TagRenderers } from "@/lib/i18n/Rich";
import { splitLead } from "@/lib/i18n/lead";

/**
 * A page's explanation in one line: its first sentence shown, the rest (and
 * anything the page adds) under "How this works", opened with a tap. Works in
 * server and browser components alike; the words come translated.
 */
export function PageIntro({
  text,
  more,
  tags,
  extra,
}: {
  text: string;
  /** "How this works", in the reader's language. */
  more: string;
  tags?: TagRenderers;
  extra?: ReactNode;
}) {
  const { lead, rest } = splitLead(text);
  if (!rest && !extra) {
    return (
      <p className="page-intro muted" data-testid="page-intro">
        <Rich text={lead} tags={tags} />
      </p>
    );
  }
  return (
    <details className="page-intro" data-testid="page-intro">
      <summary>
        <span className="muted">
          <Rich text={lead} tags={tags} />
        </span>{" "}
        <span className="page-intro-more">{more}</span>
      </summary>
      <p className="muted">
        {rest && <Rich text={rest} tags={tags} />}
        {extra}
      </p>
    </details>
  );
}
