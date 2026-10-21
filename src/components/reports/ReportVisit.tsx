"use client";

import { useEffect } from "react";
import { noteReportVisitAction } from "@/lib/actions/receipt";

/**
 * Counts this report as opened by the person reading it (0091), so Reports
 * puts the ones they open most first. Draws nothing; once per opening.
 */
export function ReportVisit({ path }: { path: string }) {
  useEffect(() => {
    void noteReportVisitAction({ path }).catch(() => undefined);
  }, [path]);
  return null;
}
