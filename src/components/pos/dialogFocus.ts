"use client";

import { useEffect, useRef } from "react";

/**
 * A dialog takes the keyboard as it opens: focus moves into it, unless a box
 * of its own already has it, so Enter and Escape are the dialog's and nothing
 * typed lands in the till behind it (round five: the till from a keyboard).
 * As it closes, focus goes back to where it was. The element given the ref
 * takes focus itself: give it tabIndex={-1}.
 */
export function useDialogFocus<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const before = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    // After the dialog's own effects, which may focus a box of its own first.
    const frame = requestAnimationFrame(() => {
      const box = ref.current;
      if (box && !box.contains(document.activeElement)) box.focus({ preventScroll: true });
    });
    return () => {
      cancelAnimationFrame(frame);
      if (before && before !== document.body && before.isConnected)
        before.focus({ preventScroll: true });
    };
  }, []);
  return ref;
}
