"use client";

import { useEffect } from "react";

/**
 * Opens the fold-out (a <details>) with this id when the address asks for it,
 * as Getting set up's links do (/production#new-recipe), and brings it into
 * view. Nothing is drawn.
 */
export function OpenOnHash({ id }: { id: string }) {
  useEffect(() => {
    if (window.location.hash !== `#${id}`) return;
    const el = document.getElementById(id);
    if (el instanceof HTMLDetailsElement) el.open = true;
    el?.scrollIntoView({ block: "start" });
  }, [id]);
  return null;
}
