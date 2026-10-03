"use client";

import { useState, type ReactNode } from "react";

/**
 * Shown while there is a reason to, and kept once it has been: a form that
 * does its work and takes the reason away (a drawer closed from the end of
 * the day) stays on the screen with its answer, until the page is opened again.
 */
export function KeepShown({ show, children }: { show: boolean; children: ReactNode }) {
  const [shown] = useState(show);
  return shown || show ? <>{children}</> : null;
}
