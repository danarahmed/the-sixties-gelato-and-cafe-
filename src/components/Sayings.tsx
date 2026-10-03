import Link from "next/link";

export interface Saying {
  tone: "ok" | "warn" | "info";
  /** A mark beside it, echoing the words (▲ ▼ ● ! ★). */
  icon: string;
  text: string;
  /** The figures behind it, quieter. */
  detail?: string;
  /** Where to act on it. */
  href?: string;
}

/**
 * What the figures say, in words: each with its mark, the figures behind it,
 * and a link to where to act on it. The dashboard's and the reports'.
 */
export function Sayings({ items }: { items: Saying[] }) {
  return (
    <ul className="sayings">
      {items.map((s) => (
        <li key={s.text} className={`saying ${s.tone}`}>
          <span className="saying-icon" aria-hidden="true">
            {s.icon}
          </span>
          <span>
            {s.href ? <Link href={s.href}>{s.text}</Link> : s.text}
            {s.detail && <span className="saying-detail">{s.detail}</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}
