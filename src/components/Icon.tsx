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
