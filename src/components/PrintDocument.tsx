"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * A page's document printed on its own, on a sheet of paper (a purchase order
 * for its supplier, say): a copy is kept out of sight at the top of the page,
 * and only it is printed. The button prints it.
 */
export function PrintDocument({ label, children }: { label: string; children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return (
    <>
      <button type="button" onClick={() => window.print()} data-testid="print-document">
        {label}
      </button>
      {mounted && createPortal(<div className="print-doc">{children}</div>, document.body)}
    </>
  );
}
