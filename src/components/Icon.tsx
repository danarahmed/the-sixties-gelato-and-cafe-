import type { ReactNode } from "react";

/**
 * The screens' icons: drawn here, a few strokes each, in the colour of the
 * words beside them, so they follow the theme and load nothing. Each sits
 * next to words that say the same, so a screen reader passes over it.
 */
const PATHS = {
  dashboard: (
    <>
      <rect x="3.5" y="3.5" width="7" height="8" rx="2" />
      <rect x="13.5" y="3.5" width="7" height="5" rx="2" />
      <rect x="13.5" y="11.5" width="7" height="9" rx="2" />
      <rect x="3.5" y="14.5" width="7" height="6" rx="2" />
    </>
  ),
  sales: (
    <>
      <path d="M3.5 16.5l5.5-5.5 4 4 7.5-7.5" />
      <path d="M15 7.5h5.5V13" />
    </>
  ),
  platforms: (
    <>
      <path d="M6 8.5h12l-1.2 11.2a1.5 1.5 0 0 1-1.5 1.3H8.7a1.5 1.5 0 0 1-1.5-1.3z" />
      <path d="M9 8.5V7a3 3 0 0 1 6 0v1.5" />
    </>
  ),
  customers: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
      <path d="M15.5 4.6a3.5 3.5 0 0 1 0 6.8" />
      <path d="M18 14a6.5 6.5 0 0 1 3.5 6" />
    </>
  ),
  vendors: (
    <>
      <path d="M2.5 6.5h11v10h-11z" />
      <path d="M13.5 9.5h4l3 3.2v3.8h-7" />
      <circle cx="6.5" cy="18" r="2" />
      <circle cx="17" cy="18" r="2" />
    </>
  ),
  expenses: (
    <>
      <path d="M6 3.5h12v17l-3-1.6-3 1.6-3-1.6-3 1.6z" />
      <path d="M9.5 8h5M9.5 11.5h5M9.5 15h3" />
    </>
  ),
  purchasing: (
    <>
      <rect x="5" y="4.5" width="14" height="16" rx="2" />
      <path d="M9 4.5v-1h6v1" />
      <path d="M9 9.5h6M9 13h6M9 16.5h3.5" />
    </>
  ),
  payroll: (
    <>
      <rect x="2.5" y="6" width="19" height="12" rx="2.5" />
      <circle cx="12" cy="12" r="2.6" />
      <path d="M6 9.5v5M18 9.5v5" />
    </>
  ),
  cone: (
    <>
      <path d="M7.6 11.5L12 21.5l4.4-10" />
      <path d="M6.5 11.5a5.5 5.5 0 0 1 11 0z" />
      <path d="M9.6 15.5h4.8" />
    </>
  ),
  orders: (
    <>
      <path d="M8.5 6.5h12M8.5 12h12M8.5 17.5h12" />
      <circle cx="4.5" cy="6.5" r="1" />
      <circle cx="4.5" cy="12" r="1" />
      <circle cx="4.5" cy="17.5" r="1" />
    </>
  ),
  cup: (
    <>
      <path d="M4 9.5h12.5V14a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z" />
      <path d="M16.5 11h1.25a2.25 2.25 0 0 1 0 4.5H16.3" />
      <path d="M8 3.5c-.8 1 .8 2 0 3M12 3.5c-.8 1 .8 2 0 3" />
    </>
  ),
  box: (
    <>
      <path d="M3.5 7.5L12 3.5l8.5 4v9L12 20.5l-8.5-4z" />
      <path d="M3.5 7.5L12 11.5l8.5-4" />
      <path d="M12 11.5v9" />
    </>
  ),
  count: (
    <>
      <rect x="5" y="4.5" width="14" height="16" rx="2" />
      <path d="M9 4.5v-1h6v1" />
      <path d="M9 12.5l2 2 4-4" />
    </>
  ),
  usage: (
    <>
      <path d="M12 3.5a8.5 8.5 0 1 0 8.5 8.5H12z" />
      <path d="M15 3.9a8.5 8.5 0 0 1 5.1 5.1H15z" />
    </>
  ),
  transfers: (
    <>
      <path d="M4 8.5h15l-3.5-3.5" />
      <path d="M20 15.5H5l3.5 3.5" />
    </>
  ),
  bowl: (
    <>
      <path d="M3.5 11h17a8.5 8.5 0 0 1-17 0z" />
      <path d="M14 11l4.5-7.5" />
    </>
  ),
  staff: (
    <>
      <rect x="4.5" y="3.5" width="15" height="17" rx="2.5" />
      <circle cx="12" cy="10" r="2.8" />
      <path d="M8 17a4 4 0 0 1 8 0" />
    </>
  ),
  book: (
    <>
      <path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5z" />
      <path d="M5 19.5A1.5 1.5 0 0 0 6.5 21H19v-3" />
      <path d="M9 7.5h6M9 11h4" />
    </>
  ),
  ledger: (
    <>
      <rect x="3.5" y="4" width="17" height="16" rx="2" />
      <path d="M3.5 9h17M9.5 9v11" />
    </>
  ),
  reports: (
    <>
      <path d="M3.5 20.5h17" />
      <rect x="5.5" y="11" width="3" height="6.5" rx="1" />
      <rect x="10.5" y="6" width="3" height="11.5" rx="1" />
      <rect x="15.5" y="13" width="3" height="4.5" rx="1" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3.5l7.5 2.8v5.6c0 4.6-3.2 7.6-7.5 8.6-4.3-1-7.5-4-7.5-8.6V6.3z" />
      <path d="M9 12l2 2 4-4" />
    </>
  ),
  settings: (
    <>
      <path d="M4 7h9M17 7h3M4 12h3M11 12h9M4 17h11M19 17h1" />
      <circle cx="15" cy="7" r="2" />
      <circle cx="9" cy="12" r="2" />
      <circle cx="17" cy="17" r="2" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8.5" r="4" />
      <path d="M4.5 20.5a7.5 7.5 0 0 1 15 0" />
    </>
  ),
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2M12 19.5v2M4.6 4.6L6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4L6 18M18 6l1.4-1.4" />
    </>
  ),
  moon: <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />,
  // The end of the day: the sun going down behind the horizon.
  sunset: (
    <>
      <path d="M7 16.5a5 5 0 0 1 10 0" />
      <path d="M2.5 16.5h19M6 20h12M12 3v5.5M9.5 6.5l2.5 2.5 2.5-2.5M4.5 10.5L6 12M19.5 10.5L18 12" />
    </>
  ),
  // The till's.
  cash: (
    <>
      <rect x="2.5" y="6.5" width="19" height="11" rx="2" />
      <circle cx="12" cy="12" r="2.5" />
      <path d="M6 9.5v5M18 9.5v5" />
    </>
  ),
  card: (
    <>
      <rect x="2.5" y="5.5" width="19" height="13" rx="2" />
      <path d="M2.5 10h19M6.5 14.5h4" />
    </>
  ),
  receipt: (
    <>
      <path d="M6 3.5h12v17l-2-1.3-2 1.3-2-1.3-2 1.3-2-1.3-2 1.3z" />
      <path d="M9 8h6M9 11.5h6M9 15h3.5" />
    </>
  ),
  save: (
    <>
      <path d="M5 3.5h11l3.5 3.5v12a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 19V5A1.5 1.5 0 0 1 5 3.5z" />
      <path d="M7.5 3.5v4.5h8V3.5M7.5 20.5v-6h9v6" />
    </>
  ),
  print: (
    <>
      <path d="M7 8.5V3.5h10v5" />
      <rect x="3.5" y="8.5" width="17" height="8" rx="2" />
      <path d="M7 13.5h10v7H7z" />
    </>
  ),
  split: (
    <>
      <circle cx="6" cy="6" r="2.5" />
      <circle cx="6" cy="18" r="2.5" />
      <path d="M8 7.5l12 9M8 16.5l12-9" />
    </>
  ),
  move: <path d="M4 8h14l-3.5-3.5M20 16H6l3.5 3.5" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  gift: (
    <>
      <rect x="3.5" y="8.5" width="17" height="4" rx="1" />
      <path d="M5 12.5v8h14v-8M12 8.5v12" />
      <path d="M12 8.5C10.5 5.5 6.5 4.5 6.5 7c0 1.5 3 1.5 5.5 1.5zM12 8.5c1.5-3 5.5-4 5.5-1.5 0 1.5-3 1.5-5.5 1.5z" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="10.5" width="14" height="10" rx="2" />
      <path d="M8 10.5v-3a4 4 0 0 1 8 0v3" />
    </>
  ),
  unlock: (
    <>
      <rect x="5" y="10.5" width="14" height="10" rx="2" />
      <path d="M8 10.5v-3a4 4 0 0 1 7.7-1.5" />
    </>
  ),
  bolt: <path d="M13 2.5L5 13.5h6l-1 8 8-11h-6z" />,
  table: <path d="M3.5 8.5h17M5.5 8.5v11M18.5 8.5v11M5.5 13.5h13" />,
  expand: <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  key: (
    <>
      <circle cx="8" cy="15" r="4" />
      <path d="M11 12l8.5-8.5M16 7l2.5 2.5M14 9l2 2" />
    </>
  ),
  bag: (
    <>
      <path d="M5 8.5h14l-1.2 11H6.2z" />
      <path d="M9 8.5V7a3 3 0 0 1 6 0v1.5" />
    </>
  ),
  // The rest of the screens'.
  plus: <path d="M12 5v14M5 12h14" />,
  trash: (
    <>
      <path d="M4.5 7h15M9.5 7V4.5h5V7" />
      <path d="M6.5 7l1 13h9l1-13M10 11v5.5M14 11v5.5" />
    </>
  ),
  pencil: (
    <>
      <path d="M4 20l1-4.5L16 4.5a2.1 2.1 0 0 1 3 3L8 18.5z" />
      <path d="M14.5 6l3.5 3.5" />
    </>
  ),
  undo: <path d="M9 7.5L4.5 12 9 16.5M5 12h9.5a5 5 0 0 1 0 10H12" />,
  camera: (
    <>
      <path d="M4 8.5h3l1.5-2.5h7L17 8.5h3a1 1 0 0 1 1 1V18a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5a1 1 0 0 1 1-1z" />
      <circle cx="12" cy="13.5" r="3.5" />
    </>
  ),
  file: (
    <>
      <path d="M6.5 3.5h7l4 4v13h-11z" />
      <path d="M13.5 3.5v4h4M9 12h6M9 15.5h6" />
    </>
  ),
  image: (
    <>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
      <circle cx="9" cy="9.5" r="1.8" />
      <path d="M4 17.5l5-4.5 3.5 3 3-2.5 4.5 4" />
    </>
  ),
  clip: (
    <path d="M17.5 10.5l-6.8 6.8a3.5 3.5 0 0 1-5-5L13 5a2.3 2.3 0 0 1 3.3 3.3l-7.2 7.2a1.1 1.1 0 0 1-1.6-1.6L14 7.4" />
  ),
  alert: (
    <>
      <path d="M12 4l9 15.5H3z" />
      <path d="M12 10v4.5M12 17.2v.3" />
    </>
  ),
  ok: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M7.8 12.3l2.8 2.8 5.6-5.6" />
    </>
  ),
  bad: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9 9l6 6M15 9l-6 6" />
    </>
  ),
} satisfies Record<string, ReactNode>;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return (
    <svg
      className="icon"
      aria-hidden="true"
      focusable="false"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {PATHS[name]}
    </svg>
  );
}

/** The café's mark: a cone, in white on the café's raspberry turning to apricot. */
export function BrandMark({ size = 30 }: { size?: number }) {
  return (
    <span className="brand-mark" style={{ width: size, height: size }} aria-hidden="true">
      <Icon name="cone" size={Math.round(size * 0.62)} />
    </span>
  );
}

/**
 * A check's outcome, drawn: a tick in green, a cross in red, a warning in
 * amber — never colour alone, the shape says it too, and a screen reader is
 * told it in words. `data-state` says it to a test.
 */
export function StatusMark({
  state,
  label,
  size = 16,
}: {
  state: "ok" | "bad" | "warn";
  label: string;
  size?: number;
}) {
  return (
    <span className={`status-mark ${state}`} data-state={state} role="img" aria-label={label}>
      <Icon name={state === "ok" ? "ok" : state === "bad" ? "bad" : "alert"} size={size} />
    </span>
  );
}
